const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ACTIVE_STATUSES } = require('../utils/constants');
const { nextTokenNumber, getEntryQueueInfo } = require('../utils/queueService');
const { broadcastQueueUpdatesForService, notifyCustomerTerminalUpdate } = require('../utils/queueSocketService');

// POST /api/queue/join  { serviceId }
exports.joinQueue = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.body.serviceId);
  if (!service) throw new AppError('Service not found', 404);
  if (!service.isActive) throw new AppError('This service is currently not available', 400);
  if (service.queueStatus !== 'OPEN') {
    throw new AppError(`This queue is ${service.queueStatus.toLowerCase()} and not accepting new people`, 400);
  }

  // One active token per person at a time
  const existing = await QueueEntry.findOne({ user: req.user._id, status: { $in: ACTIVE_STATUSES } });
  if (existing) {
    throw new AppError('You already have an active token. Leave it before joining another queue.', 409);
  }

  const tokenNumber = await nextTokenNumber(service._id);
  const entry = await QueueEntry.create({
    service: service._id,
    user: req.user._id,
    tokenNumber,
    tokenLabel: `${service.code}-${String(tokenNumber).padStart(3, '0')}`,
    priority: req.user.defaultPriority,
  });

  const queueInfo = await getEntryQueueInfo(entry);

  // Notify all customers in the queue of the position updates
  broadcastQueueUpdatesForService(service._id);

  res.status(201).json({ success: true, entry, queueInfo });
});

// GET /api/queue/my-active
exports.getMyActive = asyncHandler(async (req, res) => {
  const entry = await QueueEntry.findOne({ user: req.user._id, status: { $in: ACTIVE_STATUSES } }).populate(
    'service',
    'name code queueStatus avgServiceMinutes'
  );

  if (!entry) return res.json({ success: true, entry: null, queueInfo: null });

  const queueInfo = await getEntryQueueInfo(entry);
  res.json({ success: true, entry, queueInfo });
});

// GET /api/queue/history
exports.getHistory = asyncHandler(async (req, res) => {
  const entries = await QueueEntry.find({
    user: req.user._id,
    status: { $in: ['COMPLETED', 'CANCELLED', 'SKIPPED'] },
  })
    .populate('service', 'name code')
    .sort({ joinedAt: -1 })
    .limit(100);

  res.json({ success: true, count: entries.length, entries });
});

// DELETE /api/queue/:id/leave
// We do not erase the document: it becomes CANCELLED so history and statistics stay correct.
exports.leaveQueue = asyncHandler(async (req, res) => {
  const entry = await QueueEntry.findById(req.params.id);
  // 404 for other people's tokens too, so IDs cannot be probed
  if (!entry || String(entry.user) !== String(req.user._id)) throw new AppError('Token not found', 404);

  if (!entry.canMoveTo('CANCELLED')) {
    throw new AppError(`A ${entry.status.toLowerCase()} token cannot be cancelled`, 400);
  }

  entry.status = 'CANCELLED';
  entry.cancelledAt = new Date();
  await entry.save();

  const service = await Service.findById(entry.service);
  notifyCustomerTerminalUpdate(entry, service);
  broadcastQueueUpdatesForService(entry.service);

  res.json({ success: true, message: 'You have left the queue', entry });
});
