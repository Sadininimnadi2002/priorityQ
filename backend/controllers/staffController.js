const mongoose = require('mongoose');
const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');
const PriorityLog = require('../models/PriorityLog');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ACTIVE_STATUSES } = require('../utils/constants');
const { startOfToday } = require('../utils/dates');
const {
  buildQueueView,
  describeWaiting,
  getEntryQueueInfo,
  registerCall,
  getServiceCounts,
  withQueueInfo,
  getAvgMinutes,
} = require('../utils/queueService');
const { notifyQueueEvent, notifyQueueStatusChange } = require('../utils/notificationService');
const { broadcastQueueUpdatesForService, notifyCustomerTerminalUpdate } = require('../utils/queueSocketService');

// ---- helpers ----------------------------------------------------------------

const assignedId = (user) => {
  if (!user || !user.assignedService) return null;
  return String(user.assignedService._id || user.assignedService);
};

// Staff may only touch their own service. Admins may touch any.
function assertServiceAccess(user, serviceId) {
  if (!user) throw new AppError('Authentication required', 401);
  if (user.role === 'admin') return;
  if (user.role !== 'staff') {
    throw new AppError('Only staff members or administrators can perform this action', 403);
  }
  if (!user.isActive) {
    throw new AppError('This staff account has been deactivated', 403);
  }
  const assigned = assignedId(user);
  if (!assigned || assigned !== String(serviceId)) {
    throw new AppError('You are not authorized to manage this service', 403);
  }
}

async function loadService(id) {
  const service = await Service.findById(id);
  if (!service) throw new AppError('Service not found', 404);
  return service;
}

async function loadEntry(req) {
  const entry = await QueueEntry.findById(req.params.id);
  if (!entry) throw new AppError('Token not found', 404);
  assertServiceAccess(req.user, entry.service);
  return entry;
}

// State machine check: refuse impossible changes (e.g. COMPLETED -> WAITING)
function assertCanMove(entry, to) {
  if (!entry.canMoveTo(to)) {
    throw new AppError(
      `Token ${entry.tokenLabel} is currently ${entry.status} and cannot transition to ${to}`,
      400
    );
  }
}

// ---- endpoints --------------------------------------------------------------

// GET /api/staff/my-service
exports.getMyService = asyncHandler(async (req, res) => {
  const id = assignedId(req.user);
  if (!id) return res.json({ success: true, service: null });

  const service = await Service.findById(id);
  if (!service) return res.json({ success: true, service: null });

  const counts = await getServiceCounts([service._id]);
  res.json({ success: true, service: withQueueInfo(service, counts) });
});

// GET /api/staff/queues/:serviceId  -> the live queue in priority order
exports.getQueue = asyncHandler(async (req, res) => {
  assertServiceAccess(req.user, req.params.serviceId);
  const service = await loadService(req.params.serviceId);

  const view = await buildQueueView(service);
  const waiting = view.ordered.map((item, index) => describeWaiting(item, index, view));

  const skipped = await QueueEntry.find({
    service: service._id,
    status: 'SKIPPED',
    skippedAt: { $gte: startOfToday() },
  })
    .populate('user', 'name email phone')
    .sort({ skippedAt: -1 });

  res.json({
    success: true,
    service,
    avgMinutes: view.avgMinutes,
    waiting,
    inProgress: view.inProgress,
    skipped,
  });
});

// POST /api/staff/queues/:serviceId/call-next  -> the priority algorithm picks who is next
exports.callNext = asyncHandler(async (req, res) => {
  assertServiceAccess(req.user, req.params.serviceId);
  const service = await loadService(req.params.serviceId);

  if (!service.isActive) {
    throw new AppError('This service is currently deactivated by an administrator', 400);
  }
  if (service.queueStatus === 'PAUSED') {
    throw new AppError('This queue is paused. Please resume the queue before calling tokens.', 400);
  }

  const view = await buildQueueView(service);
  if (view.ordered.length === 0) {
    throw new AppError('No customers are currently waiting in this queue', 404);
  }

  // Concurrency-safe atomic selection:
  // Iterate through ordered candidates and claim the first one that is still in 'WAITING' status
  let claimedEntry = null;
  for (const item of view.ordered) {
    const candidateId = item.entry._id;
    claimedEntry = await QueueEntry.findOneAndUpdate(
      { _id: candidateId, status: 'WAITING' },
      {
        $set: {
          status: 'CALLED',
          calledAt: new Date(),
          handledBy: req.user._id,
        },
      },
      { new: true }
    );
    if (claimedEntry) break;
  }

  if (!claimedEntry) {
    throw new AppError('No eligible waiting customers found in this queue', 404);
  }

  await registerCall(service, claimedEntry);
  await claimedEntry.populate('user', 'name email phone');

  // Notify customer in real-time and save to history
  await notifyQueueEvent({
    user: claimedEntry.user,
    queueEntry: claimedEntry,
    service,
    type: 'TOKEN_CALLED',
    title: `Your Token ${claimedEntry.tokenLabel} Has Been Called!`,
    message: `Please proceed to the ${service.name} counter.`,
    tokenLabel: claimedEntry.tokenLabel,
    serviceName: service.name,
  });

  // Broadcast updated queue positions to remaining waiting customers
  broadcastQueueUpdatesForService(service._id);

  res.json({ success: true, message: `Called token ${claimedEntry.tokenLabel}`, entry: claimedEntry });
});

// PATCH /api/staff/queue/:id/call  -> call one specific token
exports.callToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  const service = await loadService(entry.service);

  if (!service.isActive) {
    throw new AppError('This service is currently deactivated by an administrator', 400);
  }
  if (service.queueStatus === 'PAUSED') {
    throw new AppError('This queue is paused. Please resume the queue before calling tokens.', 400);
  }
  assertCanMove(entry, 'CALLED');

  const updated = await QueueEntry.findOneAndUpdate(
    { _id: entry._id, status: 'WAITING' },
    {
      $set: {
        status: 'CALLED',
        calledAt: new Date(),
        handledBy: req.user._id,
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError(`Token ${entry.tokenLabel} is no longer waiting and cannot be called`, 409);
  }

  await registerCall(service, updated);
  await updated.populate('user', 'name email phone');

  // Notify customer in real-time and save to history
  await notifyQueueEvent({
    user: updated.user,
    queueEntry: updated,
    service,
    type: 'TOKEN_CALLED',
    title: `Your Token ${updated.tokenLabel} Has Been Called!`,
    message: `Please proceed to the ${service.name} counter.`,
    tokenLabel: updated.tokenLabel,
    serviceName: service.name,
  });

  // Broadcast updated queue positions to remaining waiting customers
  broadcastQueueUpdatesForService(service._id);

  res.json({ success: true, message: `Called token ${updated.tokenLabel}`, entry: updated });
});

// PATCH /api/staff/queue/:id/serve  -> start service (CALLED -> SERVING)
exports.serveToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  assertCanMove(entry, 'SERVING');

  const updated = await QueueEntry.findOneAndUpdate(
    { _id: entry._id, status: 'CALLED' },
    {
      $set: {
        status: 'SERVING',
        servingStartedAt: new Date(),
        handledBy: req.user._id,
      },
    },
    { new: true }
  ).populate('user', 'name email phone');

  if (!updated) {
    throw new AppError(`Token ${entry.tokenLabel} is no longer in CALLED status`, 409);
  }

  const service = await loadService(updated.service);

  // Notify customer that service has commenced
  await notifyQueueEvent({
    user: updated.user,
    queueEntry: updated,
    service,
    type: 'TOKEN_SERVING',
    title: `Serving Started for Token ${updated.tokenLabel}`,
    message: `You are now being served at the ${service.name} counter.`,
    tokenLabel: updated.tokenLabel,
    serviceName: service.name,
  });

  // Broadcast updated queue positions and in-progress status
  broadcastQueueUpdatesForService(service._id);

  res.json({ success: true, message: `Now serving token ${updated.tokenLabel}`, entry: updated });
});

// PATCH /api/staff/queue/:id/complete  -> complete service (SERVING -> COMPLETED)
exports.completeToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  assertCanMove(entry, 'COMPLETED');

  const updated = await QueueEntry.findOneAndUpdate(
    { _id: entry._id, status: 'SERVING' },
    {
      $set: {
        status: 'COMPLETED',
        completedAt: new Date(),
        handledBy: entry.handledBy || req.user._id,
      },
    },
    { new: true }
  ).populate('user', 'name email phone');

  if (!updated) {
    throw new AppError(`Token ${entry.tokenLabel} is no longer in SERVING status`, 409);
  }

  const service = await loadService(updated.service);

  // Notify customer that service is completed
  await notifyQueueEvent({
    user: updated.user,
    queueEntry: updated,
    service,
    type: 'TOKEN_COMPLETED',
    title: `Service Completed for Token ${updated.tokenLabel}`,
    message: `Your visit for ${service.name} has been completed. Thank you!`,
    tokenLabel: updated.tokenLabel,
    serviceName: service.name,
  });

  // Update customer terminal status and broadcast updated queue positions
  notifyCustomerTerminalUpdate(updated, service);
  broadcastQueueUpdatesForService(service._id);

  res.json({ success: true, message: `Completed service for ${updated.tokenLabel}`, entry: updated });
});

// PATCH /api/staff/queue/:id/skip  -> skip customer (CALLED or WAITING -> SKIPPED)
exports.skipToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  assertCanMove(entry, 'SKIPPED');

  const updated = await QueueEntry.findOneAndUpdate(
    { _id: entry._id, status: { $in: ['CALLED', 'WAITING'] } },
    {
      $set: {
        status: 'SKIPPED',
        skippedAt: new Date(),
        handledBy: req.user._id,
      },
    },
    { new: true }
  ).populate('user', 'name email phone');

  if (!updated) {
    throw new AppError(`Token ${entry.tokenLabel} could not be skipped because its status has changed`, 409);
  }

  const service = await loadService(updated.service);

  // Notify customer that token was skipped
  await notifyQueueEvent({
    user: updated.user,
    queueEntry: updated,
    service,
    type: 'TOKEN_SKIPPED',
    title: `Token ${updated.tokenLabel} Was Skipped`,
    message: `Your token was marked as skipped. Please speak to staff at ${service.name} to be put back in queue.`,
    tokenLabel: updated.tokenLabel,
    serviceName: service.name,
  });

  // Update customer terminal status and broadcast updated queue positions
  notifyCustomerTerminalUpdate(updated, service);
  broadcastQueueUpdatesForService(service._id);

  res.json({ success: true, message: `Skipped token ${updated.tokenLabel}`, entry: updated });
});

// PATCH /api/staff/queue/:id/restore  -> SKIPPED back to WAITING (keeps original join time & priority)
exports.restoreToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  assertCanMove(entry, 'WAITING');

  const other = await QueueEntry.findOne({
    user: entry.user,
    status: { $in: ACTIVE_STATUSES },
    _id: { $ne: entry._id },
  });
  if (other) {
    throw new AppError('This customer already has an active token in another queue and cannot be restored', 409);
  }

  const updated = await QueueEntry.findOneAndUpdate(
    { _id: entry._id, status: 'SKIPPED' },
    {
      $set: {
        status: 'WAITING',
        calledAt: null,
        skippedAt: null,
      },
    },
    { new: true }
  ).populate('user', 'name email phone');

  if (!updated) {
    throw new AppError(`Token ${entry.tokenLabel} is no longer skipped`, 409);
  }

  const queueInfo = await getEntryQueueInfo(updated);
  broadcastQueueUpdatesForService(entry.service);

  res.json({ success: true, message: `Restored token ${updated.tokenLabel} to waiting queue`, entry: updated, queueInfo });
});

// PATCH /api/staff/queue/:id/priority  { priority, reason }
exports.changePriority = asyncHandler(async (req, res) => {
  const { priority, reason } = req.body;
  const entry = await loadEntry(req);

  if (entry.status !== 'WAITING') {
    throw new AppError('Priority can only be changed while a token is WAITING', 400);
  }
  if (entry.priority === priority) {
    throw new AppError(`Token is already ${priority}`, 400);
  }

  const oldPriority = entry.priority;
  entry.priority = priority;
  await entry.save();

  // Audit log: who changed what, from/to, and why
  const log = await PriorityLog.create({
    queueEntry: entry._id,
    service: entry.service,
    changedBy: req.user._id,
    oldPriority,
    newPriority: priority,
    reason,
  });

  const queueInfo = await getEntryQueueInfo(entry);
  broadcastQueueUpdatesForService(entry.service);

  res.json({ success: true, message: `Priority changed to ${priority}`, entry, queueInfo, log });
});

// PATCH /api/staff/service/:serviceId/queue-status  { status: OPEN | PAUSED | CLOSED }
//   OPEN   = people can join, staff can call
//   PAUSED = nobody can join, staff cannot call new tokens (e.g. lunch break)
//   CLOSED = nobody can join, staff can still call the people already waiting
exports.setQueueStatus = asyncHandler(async (req, res) => {
  assertServiceAccess(req.user, req.params.serviceId);
  const service = await loadService(req.params.serviceId);
  if (!service.isActive) {
    throw new AppError('This service is deactivated by an administrator and cannot change queue status', 400);
  }

  const prevStatus = service.queueStatus;
  const newStatus = req.body.status;

  // Prevent duplicate status change operations and redundant notifications
  if (prevStatus === newStatus) {
    return res.json({
      success: true,
      message: `Queue is already ${newStatus.toLowerCase()}`,
      service,
    });
  }

  service.queueStatus = newStatus;
  await service.save();

  // Notify affected waiting customers when a queue is paused or resumed
  await notifyQueueStatusChange({ service, newStatus, prevStatus });

  let message = `Queue status set to ${newStatus}`;
  if (newStatus === 'OPEN') {
    message = prevStatus === 'PAUSED' ? 'Queue resumed. New customers can join and tokens can be called.' : 'Queue opened. Customers can now join.';
  } else if (newStatus === 'PAUSED') {
    message = 'Queue paused. No new customers can join and token calling is temporarily paused.';
  } else if (newStatus === 'CLOSED') {
    message = 'Queue closed. No new customers can join, but existing waiting customers can still be served.';
  }

  broadcastQueueUpdatesForService(service._id);

  res.json({ success: true, message, service });
});

// GET /api/staff/stats/:serviceId
exports.getStats = asyncHandler(async (req, res) => {
  assertServiceAccess(req.user, req.params.serviceId);
  const service = await loadService(req.params.serviceId);
  const today = startOfToday();
  const serviceId = service._id;

  const [
    waitingCount,
    calledEntries,
    servingEntries,
    completedToday,
    skippedCount,
    emergencyWaitingCount,
    urgentWaitingCount,
    cancelledToday,
    avgMinutes,
  ] = await Promise.all([
    QueueEntry.countDocuments({ service: serviceId, status: 'WAITING' }),
    QueueEntry.find({ service: serviceId, status: 'CALLED' })
      .populate('user', 'name email phone')
      .sort({ calledAt: 1 }),
    QueueEntry.find({ service: serviceId, status: 'SERVING' })
      .populate('user', 'name email phone')
      .sort({ servingStartedAt: 1 }),
    QueueEntry.countDocuments({ service: serviceId, status: 'COMPLETED', completedAt: { $gte: today } }),
    QueueEntry.countDocuments({ service: serviceId, status: 'SKIPPED', skippedAt: { $gte: today } }),
    QueueEntry.countDocuments({ service: serviceId, status: 'WAITING', priority: 'EMERGENCY' }),
    QueueEntry.countDocuments({ service: serviceId, status: 'WAITING', priority: 'URGENT' }),
    QueueEntry.countDocuments({ service: serviceId, status: 'CANCELLED', cancelledAt: { $gte: today } }),
    getAvgMinutes(service),
  ]);

  const normalWaitingCount = Math.max(0, waitingCount - emergencyWaitingCount - urgentWaitingCount);
  const currentServing = [...calledEntries, ...servingEntries];

  res.json({
    success: true,
    stats: {
      waitingCount,
      calledEntries,
      servingEntries,
      currentlyCalled: calledEntries[0] || null,
      currentlyServing: servingEntries[0] || null,
      currentServing,
      completedToday,
      skippedCount,
      emergencyWaitingCount,
      urgentWaitingCount,
      normalWaitingCount,
      urgentEmergencyCount: emergencyWaitingCount + urgentWaitingCount,
      cancelledToday,
      avgServiceMinutes: avgMinutes,
      queueStatus: service.queueStatus,
      service: {
        _id: service._id,
        name: service.name,
        code: service.code,
        isActive: service.isActive,
      },
    },
  });
});

// GET /api/staff/history/:serviceId  -> recently finished tokens (completed / skipped / cancelled)
exports.getHistory = asyncHandler(async (req, res) => {
  assertServiceAccess(req.user, req.params.serviceId);
  await loadService(req.params.serviceId);

  const filter = {
    service: new mongoose.Types.ObjectId(req.params.serviceId),
    status: { $in: ['COMPLETED', 'SKIPPED', 'CANCELLED'] },
  };
  if (req.query.today === 'true') filter.updatedAt = { $gte: startOfToday() };

  const entries = await QueueEntry.find(filter)
    .populate('user', 'name email phone')
    .populate('handledBy', 'name role')
    .sort({ updatedAt: -1 })
    .limit(100);

  res.json({ success: true, count: entries.length, entries });
});
