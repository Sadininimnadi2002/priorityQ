/**
 * Database helpers for queue logic. They combine the models with the pure
 * functions in priorityEngine.js.
 */
const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');
const engine = require('./priorityEngine');
const { ACTIVE_STATUSES, PRIORITY_RANK, RANK_TO_PRIORITY } = require('./constants');
const { todayString } = require('./dates');

// ---- Tokens ---------------------------------------------------------------
// Atomic daily counter: $inc happens inside MongoDB, so two people joining at the
// same moment can never receive the same number.
async function nextTokenNumber(serviceId) {
  const today = todayString();
  const incUpdate = { $inc: { 'tokenCounter.seq': 1 } };

  let svc = await Service.findOneAndUpdate({ _id: serviceId, 'tokenCounter.date': today }, incUpdate, { new: true });
  if (!svc) {
    // first token of a new day: reset the counter
    svc = await Service.findOneAndUpdate(
      { _id: serviceId, 'tokenCounter.date': { $ne: today } },
      { $set: { tokenCounter: { date: today, seq: 1 } } },
      { new: true }
    );
  }
  if (!svc) {
    // someone else reset it a split-second before us: just increment now
    svc = await Service.findOneAndUpdate({ _id: serviceId, 'tokenCounter.date': today }, incUpdate, { new: true });
  }
  return svc.tokenCounter.seq;
}

// ---- Waiting time ---------------------------------------------------------
// Average service minutes: configured value, improved by real data from the last 20 completed tokens
async function getAvgMinutes(service) {
  const recent = await QueueEntry.find({
    service: service._id,
    status: 'COMPLETED',
    servingStartedAt: { $ne: null },
    completedAt: { $ne: null },
  })
    .sort({ completedAt: -1 })
    .limit(20)
    .select('servingStartedAt completedAt')
    .lean();

  const durations = recent.map((r) => (r.completedAt - r.servingStartedAt) / 60000);
  return engine.blendAverage(service.avgServiceMinutes, durations);
}

// Loads everything needed to describe one service's queue right now
async function buildQueueView(service) {
  const [waiting, inProgress] = await Promise.all([
    QueueEntry.find({ service: service._id, status: 'WAITING' }).populate('user', 'name email phone'),
    QueueEntry.find({ service: service._id, status: { $in: ['CALLED', 'SERVING'] } })
      .populate('user', 'name email phone')
      .sort({ calledAt: 1 }),
  ]);

  const now = Date.now();
  const ordered = engine.orderQueue(waiting, service.consecutiveHighServed, now);
  const avgMinutes = await getAvgMinutes(service);

  return { ordered, inProgress, inServiceCount: inProgress.length, avgMinutes, now };
}

// Turn one ordered item into a plain object with position/ETA information
function describeWaiting(item, index, view) {
  const obj = item.entry.toObject ? item.entry.toObject() : item.entry;
  return {
    ...obj,
    position: index + 1,
    peopleAhead: index + view.inServiceCount,
    estimatedWaitMinutes: engine.estimateWait(index, view.inProgress, view.avgMinutes, view.now),
    effectivePriority: RANK_TO_PRIORITY[item.rank],
    boosted: item.rank < PRIORITY_RANK[obj.priority], // promoted because of waiting time
    waitedMinutes: Math.max(0, Math.floor((view.now - new Date(obj.joinedAt).getTime()) / 60000)),
  };
}

// Position info for ONE entry (used by the customer)
async function getEntryQueueInfo(entry) {
  const serviceId = entry.service._id || entry.service;
  const service = await Service.findById(serviceId);
  if (!service) return null;

  if (entry.status !== 'WAITING') {
    return {
      position: 0,
      peopleAhead: 0,
      estimatedWaitMinutes: 0,
      avgMinutes: service.avgServiceMinutes,
      queueStatus: service.queueStatus,
      totalWaiting: 0,
    };
  }

  const view = await buildQueueView(service);
  const index = view.ordered.findIndex((item) => String(item.entry._id) === String(entry._id));
  if (index === -1) return null;

  const info = describeWaiting(view.ordered[index], index, view);
  const isPaused = service.queueStatus === 'PAUSED';
  return {
    position: info.position,
    peopleAhead: info.peopleAhead,
    estimatedWaitMinutes: isPaused ? null : info.estimatedWaitMinutes,
    avgMinutes: view.avgMinutes,
    effectivePriority: info.effectivePriority,
    boosted: info.boosted,
    queueStatus: service.queueStatus,
    isPaused,
    totalWaiting: view.ordered.length,
  };
}

// ---- Fairness counter -----------------------------------------------------
// Call this every time someone is called, to keep the "high-priority streak" up to date
async function registerCall(service, entry) {
  const rank = engine.getEffectiveRank(entry, Date.now());
  const normalWaiting = await QueueEntry.countDocuments({
    service: service._id,
    status: 'WAITING',
    priority: 'NORMAL',
  });
  service.consecutiveHighServed = engine.nextStreak(service.consecutiveHighServed, rank, normalWaiting > 0);
  await service.save();
}

// ---- Service list helpers -------------------------------------------------
// One database query gives counts for many services at once
async function getServiceCounts(serviceIds) {
  const rows = await QueueEntry.aggregate([
    { $match: { service: { $in: serviceIds }, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: { service: '$service', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const map = {};
  serviceIds.forEach((id) => {
    map[String(id)] = { waiting: 0, inService: 0 };
  });
  rows.forEach((r) => {
    const key = String(r._id.service);
    if (r._id.status === 'WAITING') map[key].waiting += r.count;
    else map[key].inService += r.count;
  });
  return map;
}

// Rough estimate for someone who joins right now
function withQueueInfo(service, counts) {
  const c = counts[String(service._id)] || { waiting: 0, inService: 0 };
  return {
    ...service.toObject(),
    waitingCount: c.waiting,
    inServiceCount: c.inService,
    estimatedWaitMinutes: Math.ceil((c.waiting + c.inService) * service.avgServiceMinutes),
  };
}

module.exports = {
  nextTokenNumber,
  getAvgMinutes,
  buildQueueView,
  describeWaiting,
  getEntryQueueInfo,
  registerCall,
  getServiceCounts,
  withQueueInfo,
};
