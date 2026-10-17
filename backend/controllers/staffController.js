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

// ---- helpers ----------------------------------------------------------------

const assignedId = (user) => (user.assignedService ? String(user.assignedService._id || user.assignedService) : null);

// Staff may only touch their own service. Admins may touch any.
function assertServiceAccess(user, serviceId) {
  if (user.role === 'admin') return;
  if (assignedId(user) !== String(serviceId)) {
    throw new AppError('You are not assigned to this service', 403);
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

// State machine step: refuse impossible changes (e.g. COMPLETED -> WAITING)
function moveEntry(entry, to, timeField) {
  if (!entry.canMoveTo(to)) {
    throw new AppError(`Token ${entry.tokenLabel} is ${entry.status} and cannot be changed to ${to}`, 400);
  }
  entry.status = to;
  if (timeField) entry[timeField] = new Date();
}

async function callEntry(entry, service, staffUser) {
  if (service.queueStatus === 'PAUSED') {
    throw new AppError('This queue is paused. Resume it before calling tokens.', 400);
  }
  moveEntry(entry, 'CALLED', 'calledAt');
  entry.handledBy = staffUser._id;
  await entry.save();
  await registerCall(service, entry);
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

// POST /api/staff/queues/:serviceId/call-next  -> the algorithm picks who is next
exports.callNext = asyncHandler(async (req, res) => {
  assertServiceAccess(req.user, req.params.serviceId);
  const service = await loadService(req.params.serviceId);

  if (service.queueStatus === 'PAUSED') {
    throw new AppError('This queue is paused. Resume it before calling tokens.', 400);
  }

  const view = await buildQueueView(service);
  if (view.ordered.length === 0) throw new AppError('Nobody is waiting in this queue', 404);

  const entry = await QueueEntry.findById(view.ordered[0].entry._id); // fresh, un-populated document
  await callEntry(entry, service, req.user);
  await entry.populate('user', 'name email phone');

  res.json({ success: true, message: `Called ${entry.tokenLabel}`, entry });
});

// PATCH /api/staff/queue/:id/call  -> call one specific token
exports.callToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  const service = await loadService(entry.service);
  await callEntry(entry, service, req.user);
  await entry.populate('user', 'name email phone');
  res.json({ success: true, message: `Called ${entry.tokenLabel}`, entry });
});

// PATCH /api/staff/queue/:id/serve
exports.serveToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  moveEntry(entry, 'SERVING', 'servingStartedAt');
  entry.handledBy = req.user._id;
  await entry.save();
  res.json({ success: true, message: `Now serving ${entry.tokenLabel}`, entry });
});

// PATCH /api/staff/queue/:id/complete
exports.completeToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  moveEntry(entry, 'COMPLETED', 'completedAt');
  await entry.save();
  res.json({ success: true, message: `Completed ${entry.tokenLabel}`, entry });
});

// PATCH /api/staff/queue/:id/skip
exports.skipToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);
  moveEntry(entry, 'SKIPPED', 'skippedAt');
  await entry.save();
  res.json({ success: true, message: `Skipped ${entry.tokenLabel}`, entry });
});

// PATCH /api/staff/queue/:id/restore  -> SKIPPED back to WAITING (keeps original join time)
exports.restoreToken = asyncHandler(async (req, res) => {
  const entry = await loadEntry(req);

  const other = await QueueEntry.findOne({
    user: entry.user,
    status: { $in: ACTIVE_STATUSES },
    _id: { $ne: entry._id },
  });
  if (other) throw new AppError('This customer already joined another queue', 409);

  moveEntry(entry, 'WAITING');
  entry.calledAt = null;
  entry.skippedAt = null;
  await entry.save();

  const queueInfo = await getEntryQueueInfo(entry);
  res.json({ success: true, message: `Restored ${entry.tokenLabel}`, entry, queueInfo });
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
  res.json({ success: true, message: `Priority changed to ${priority}`, entry, queueInfo, log });
});

// PATCH /api/staff/service/:serviceId/queue-status  { status: OPEN | PAUSED | CLOSED }
//   OPEN   = people can join, staff can call
//   PAUSED = nobody can join, staff cannot call new tokens (e.g. lunch break)
//   CLOSED = nobody can join, staff can still call the people already waiting
exports.setQueueStatus = asyncHandler(async (req, res) => {
  assertServiceAccess(req.user, req.params.serviceId);
  const service = await loadService(req.params.serviceId);
  if (!service.isActive) throw new AppError('This service is deactivated by an admin', 400);

  service.queueStatus = req.body.status;
  await service.save();
  res.json({ success: true, message: `Queue is now ${service.queueStatus}`, service });
});

// GET /api/staff/stats/:serviceId
exports.getStats = asyncHandler(async (req, res) => {
  assertServiceAccess(req.user, req.params.serviceId);
  const service = await loadService(req.params.serviceId);
  const today = startOfToday();
  const serviceId = service._id;

  const [waitingCount, serving, completedToday, skippedCount, urgentEmergencyCount, cancelledToday, avgMinutes] =
    await Promise.all([
      QueueEntry.countDocuments({ service: serviceId, status: 'WAITING' }),
      QueueEntry.find({ service: serviceId, status: { $in: ['CALLED', 'SERVING'] } })
        .populate('user', 'name')
        .sort({ calledAt: 1 }),
      QueueEntry.countDocuments({ service: serviceId, status: 'COMPLETED', completedAt: { $gte: today } }),
      QueueEntry.countDocuments({ service: serviceId, status: 'SKIPPED', skippedAt: { $gte: today } }),
      QueueEntry.countDocuments({
        service: serviceId,
        status: 'WAITING',
        priority: { $in: ['EMERGENCY', 'URGENT'] },
      }),
      QueueEntry.countDocuments({ service: serviceId, status: 'CANCELLED', cancelledAt: { $gte: today } }),
      getAvgMinutes(service),
    ]);

  res.json({
    success: true,
    stats: {
      waitingCount,
      currentServing: serving,
      completedToday,
      skippedCount,
      cancelledToday,
      urgentEmergencyCount,
      avgServiceMinutes: avgMinutes,
      queueStatus: service.queueStatus,
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
    .populate('user', 'name')
    .populate('handledBy', 'name')
    .sort({ updatedAt: -1 })
    .limit(100);

  res.json({ success: true, count: entries.length, entries });
});
