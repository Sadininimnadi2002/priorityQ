const mongoose = require('mongoose');
const User = require('../models/User');
const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');
const PriorityLog = require('../models/PriorityLog');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ACTIVE_STATUSES, ROLES } = require('../utils/constants');
const { startOfToday, escapeRegex } = require('../utils/dates');

const parsePaging = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

async function assertServiceExists(serviceId) {
  if (!serviceId) return;
  const exists = await Service.exists({ _id: serviceId });
  if (!exists) throw new AppError('Assigned service does not exist', 404);
}

// ---------------- USERS & STAFF ----------------

// GET /api/admin/users?role=staff&q=john&isActive=true&page=1&limit=20
exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req);
  const filter = {};
  if (req.query.role && ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (req.query.isActive === 'true' || req.query.isActive === 'false') {
    filter.isActive = req.query.isActive === 'true';
  }
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q)), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).populate('assignedService', 'name code').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, total, page, pages: Math.ceil(total / limit) || 1, users });
});

// GET /api/admin/users/:id
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('assignedService', 'name code');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, user });
});

// POST /api/admin/users  (create a user, staff member or another admin)
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, assignedService, defaultPriority } = req.body;
  const finalRole = role || 'user';

  if (assignedService) await assertServiceExists(assignedService);

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: finalRole,
    defaultPriority,
    assignedService: finalRole === 'staff' ? assignedService || null : null,
  });
  await user.populate('assignedService', 'name code');
  res.status(201).json({ success: true, user });
});

// PUT /api/admin/users/:id
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  const isSelf = String(user._id) === String(req.user._id);
  if (isSelf && ((req.body.role && req.body.role !== 'admin') || req.body.isActive === false)) {
    throw new AppError('You cannot remove your own admin access or deactivate yourself', 400);
  }

  // Prevent accidental removal or deactivation of the last active administrator
  if (user.role === 'admin' && (req.body.isActive === false || (req.body.role && req.body.role !== 'admin'))) {
    const activeAdminsCount = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } });
    if (activeAdminsCount === 0) {
      throw new AppError('Cannot deactivate or remove admin role from the last active administrator account', 400);
    }
  }

  ['name', 'email', 'phone', 'role', 'isActive', 'defaultPriority', 'password'].forEach((field) => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });

  if (req.body.assignedService !== undefined) {
    await assertServiceExists(req.body.assignedService);
    user.assignedService = req.body.assignedService;
  }
  if (user.role !== 'staff') user.assignedService = null; // only staff have an assigned service

  await user.save();
  await user.populate('assignedService', 'name code');
  res.json({ success: true, user });
});

// DELETE /api/admin/users/:id
// Users with queue history are deactivated (so reports stay correct); others are deleted.
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (String(user._id) === String(req.user._id)) throw new AppError('You cannot delete yourself', 400);

  // Prevent deleting the last active administrator
  if (user.role === 'admin') {
    const activeAdminsCount = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } });
    if (activeAdminsCount === 0) {
      throw new AppError('Cannot delete the last active administrator account', 400);
    }
  }

  const hasHistory = await QueueEntry.exists({ user: user._id });
  if (hasHistory) {
    user.isActive = false;
    await user.save();
    return res.json({ success: true, message: 'User has queue history, so the account was deactivated instead of deleted' });
  }

  await user.deleteOne();
  res.json({ success: true, message: 'User deleted' });
});

// PATCH /api/admin/staff/:id/assign  { serviceId }  (null to unassign)
exports.assignStaff = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user.role !== 'staff') throw new AppError('Only staff members can be assigned to a service', 400);

  const serviceId = req.body.serviceId || null;
  await assertServiceExists(serviceId);

  user.assignedService = serviceId;
  await user.save();
  await user.populate('assignedService', 'name code');
  res.json({ success: true, user });
});

// ---------------- QUEUES ----------------

// GET /api/admin/queues  -> every service with its live numbers
exports.getActiveQueues = asyncHandler(async (req, res) => {
  const [services, entries, staff] = await Promise.all([
    Service.find().sort({ name: 1 }),
    QueueEntry.find({ status: { $in: ACTIVE_STATUSES } }).select('service status priority'),
    User.find({ role: 'staff', assignedService: { $ne: null } }).select('name assignedService'),
  ]);

  const queues = services.map((service) => {
    const mine = entries.filter((e) => String(e.service) === String(service._id));
    return {
      service,
      waiting: mine.filter((e) => e.status === 'WAITING').length,
      called: mine.filter((e) => e.status === 'CALLED').length,
      serving: mine.filter((e) => e.status === 'SERVING').length,
      byPriority: {
        EMERGENCY: mine.filter((e) => e.status === 'WAITING' && e.priority === 'EMERGENCY').length,
        URGENT: mine.filter((e) => e.status === 'WAITING' && e.priority === 'URGENT').length,
        NORMAL: mine.filter((e) => e.status === 'WAITING' && e.priority === 'NORMAL').length,
      },
      staff: staff.filter((s) => String(s.assignedService) === String(service._id)).map((s) => ({ _id: s._id, name: s.name })),
    };
  });

  res.json({ success: true, queues });
});

// GET /api/admin/priority-logs?serviceId=...&page=1&limit=20
exports.getPriorityLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req);
  const filter = {};
  if (req.query.serviceId) {
    if (!mongoose.isValidObjectId(req.query.serviceId)) throw new AppError('Invalid serviceId', 400);
    filter.service = req.query.serviceId;
  }

  const [logs, total] = await Promise.all([
    PriorityLog.find(filter)
      .populate('queueEntry', 'tokenLabel status')
      .populate('service', 'name code')
      .populate('changedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PriorityLog.countDocuments(filter),
  ]);

  res.json({ success: true, total, page, pages: Math.ceil(total / limit) || 1, logs });
});

// ---------------- STATISTICS ----------------

// GET /api/admin/stats  -> dashboard numbers
exports.getStats = asyncHandler(async (req, res) => {
  const today = startOfToday();

  const [
    totalUsers,
    totalStaff,
    totalServices,
    activeServiceIds,
    totalWaiting,
    usersServedToday,
    waitAgg,
    priorityWaitingAgg,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'staff' }),
    Service.countDocuments(),
    QueueEntry.distinct('service', { status: { $in: ACTIVE_STATUSES } }),
    QueueEntry.countDocuments({ status: 'WAITING' }),
    QueueEntry.countDocuments({ status: 'COMPLETED', completedAt: { $gte: today } }),
    QueueEntry.aggregate([
      { $match: { status: 'COMPLETED', completedAt: { $gte: today }, calledAt: { $ne: null } } },
      { $group: { _id: null, avgMs: { $avg: { $subtract: ['$calledAt', '$joinedAt'] } } } },
    ]),
    QueueEntry.aggregate([
      { $match: { status: 'WAITING' } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
  ]);

  const avgWaitingMinutes = waitAgg.length ? Math.round((waitAgg[0].avgMs / 60000) * 10) / 10 : 0;
  const priorityDistribution = { EMERGENCY: 0, URGENT: 0, NORMAL: 0 };
  priorityWaitingAgg.forEach((p) => {
    if (p._id && priorityDistribution[p._id] !== undefined) {
      priorityDistribution[p._id] = p.count;
    }
  });

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalStaff,
      totalServices,
      activeQueues: activeServiceIds.length, // services that currently have people in them
      totalWaiting,
      usersServedToday,
      avgWaitingMinutes,
      priorityDistribution,
    },
  });
});

// GET /api/admin/reports?days=7
exports.getReports = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
  const since = startOfToday();
  since.setDate(since.getDate() - (days - 1));

  const [byDay, statusRows, byPriority, services] = await Promise.all([
    QueueEntry.aggregate([
      { $match: { status: 'COMPLETED', completedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          completed: { $sum: 1 },
          avgWaitMs: { $avg: { $subtract: ['$calledAt', '$joinedAt'] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    QueueEntry.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { service: '$service', status: '$status' }, count: { $sum: 1 } } },
    ]),
    QueueEntry.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Service.find().select('name code'),
  ]);

  const byServiceMap = {};
  services.forEach((s) => {
    byServiceMap[String(s._id)] = {
      service: { _id: s._id, name: s.name, code: s.code },
      total: 0,
      COMPLETED: 0,
      SKIPPED: 0,
      CANCELLED: 0,
      ACTIVE: 0,
    };
  });
  statusRows.forEach((row) => {
    const bucket = byServiceMap[String(row._id.service)];
    if (!bucket) return;
    bucket.total += row.count;
    if (ACTIVE_STATUSES.includes(row._id.status)) bucket.ACTIVE += row.count;
    else bucket[row._id.status] += row.count;
  });

  const totalCustomersServed = byDay.reduce((sum, d) => sum + d.completed, 0);
  const totalSkipped = statusRows.filter((r) => r._id.status === 'SKIPPED').reduce((sum, r) => sum + r.count, 0);
  const totalCancelled = statusRows.filter((r) => r._id.status === 'CANCELLED').reduce((sum, r) => sum + r.count, 0);

  res.json({
    success: true,
    days,
    since,
    totalCustomersServed,
    totalSkipped,
    totalCancelled,
    byDay: byDay.map((d) => ({
      date: d._id,
      completed: d.completed,
      avgWaitMinutes: Math.round((d.avgWaitMs / 60000) * 10) / 10,
    })),
    byService: Object.values(byServiceMap),
    byPriority: byPriority.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), { EMERGENCY: 0, URGENT: 0, NORMAL: 0 }),
  });
});

// GET /api/admin/analytics?period=today|7days|30days|custom&startDate=...&endDate=...
exports.getAnalytics = asyncHandler(async (req, res) => {
  const period = req.query.period || '7days';
  const todayStart = startOfToday();
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  let startDate, endDate;
  if (period === 'today') {
    startDate = new Date(todayStart);
    endDate = new Date(todayEnd);
  } else if (period === '30days') {
    startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - 29);
    endDate = new Date(todayEnd);
  } else if (period === 'custom' && req.query.startDate && req.query.endDate) {
    startDate = new Date(req.query.startDate);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(req.query.endDate);
    endDate.setHours(23, 59, 59, 999);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      startDate = new Date(todayStart);
      startDate.setDate(startDate.getDate() - 6);
      endDate = new Date(todayEnd);
    }
  } else {
    // default: 7days
    startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - 6);
    endDate = new Date(todayEnd);
  }

  // Execute efficient MongoDB aggregation queries in parallel
  const [
    totalTokensToday,
    servedToday,
    currentlyWaiting,
    waitTodayAgg,
    activeServicesCount,
    emergencyToday,

    totalTokensPeriod,
    servedPeriod,
    waitPeriodAgg,
    emergencyPeriod,

    dailyCompletedAgg,
    dailyCreatedAgg,
    priorityAgg,
    servicePerformanceAgg,
    allServices,
  ] = await Promise.all([
    // 1. Dashboard summary cards (Today metrics)
    QueueEntry.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
    QueueEntry.countDocuments({ status: 'COMPLETED', completedAt: { $gte: todayStart, $lte: todayEnd } }),
    QueueEntry.countDocuments({ status: 'WAITING' }),
    QueueEntry.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          completedAt: { $gte: todayStart, $lte: todayEnd },
          $or: [{ calledAt: { $ne: null } }, { servingStartedAt: { $ne: null } }],
          joinedAt: { $ne: null },
        },
      },
      {
        $project: {
          firstEvent: { $ifNull: ['$calledAt', '$servingStartedAt'] },
          joinedAt: '$joinedAt',
        },
      },
      {
        $project: {
          waitMs: { $subtract: ['$firstEvent', '$joinedAt'] },
        },
      },
      {
        $match: { waitMs: { $gte: 0 } },
      },
      {
        $group: {
          _id: null,
          avgWaitMs: { $avg: '$waitMs' },
          count: { $sum: 1 },
        },
      },
    ]),
    Service.countDocuments({ isActive: true }),
    QueueEntry.countDocuments({ priority: 'EMERGENCY', createdAt: { $gte: todayStart, $lte: todayEnd } }),

    // Period summary metrics
    QueueEntry.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
    QueueEntry.countDocuments({ status: 'COMPLETED', completedAt: { $gte: startDate, $lte: endDate } }),
    QueueEntry.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          completedAt: { $gte: startDate, $lte: endDate },
          $or: [{ calledAt: { $ne: null } }, { servingStartedAt: { $ne: null } }],
          joinedAt: { $ne: null },
        },
      },
      {
        $project: {
          firstEvent: { $ifNull: ['$calledAt', '$servingStartedAt'] },
          joinedAt: '$joinedAt',
        },
      },
      {
        $project: {
          waitMs: { $subtract: ['$firstEvent', '$joinedAt'] },
        },
      },
      {
        $match: { waitMs: { $gte: 0 } },
      },
      {
        $group: {
          _id: null,
          avgWaitMs: { $avg: '$waitMs' },
          count: { $sum: 1 },
        },
      },
    ]),
    QueueEntry.countDocuments({ priority: 'EMERGENCY', createdAt: { $gte: startDate, $lte: endDate } }),

    // 2. Daily served customers aggregation
    QueueEntry.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          completedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          completed: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 3. Daily created tokens aggregation
    QueueEntry.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          created: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 4. Stored priority distribution
    QueueEntry.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]),

    // 6. Service performance aggregation
    QueueEntry.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          completedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$service',
          completed: { $sum: 1 },
        },
      },
      { $sort: { completed: -1 } },
    ]),

    Service.find().select('name code isActive').lean(),
  ]);

  const avgWaitMinutesToday =
    waitTodayAgg.length && waitTodayAgg[0].count > 0
      ? Math.round((waitTodayAgg[0].avgWaitMs / 60000) * 10) / 10
      : null;

  const avgWaitMinutesPeriod =
    waitPeriodAgg.length && waitPeriodAgg[0].count > 0
      ? Math.round((waitPeriodAgg[0].avgWaitMs / 60000) * 10) / 10
      : null;

  // Build contiguous daily series
  const completedMap = {};
  dailyCompletedAgg.forEach((d) => {
    completedMap[d._id] = d.completed;
  });

  const createdMap = {};
  dailyCreatedAgg.forEach((d) => {
    createdMap[d._id] = d.created;
  });

  const dailyActivity = [];
  const cur = new Date(startDate);
  let safety = 0;
  while (cur <= endDate && safety < 100) {
    safety++;
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${d}`;
    const label = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    dailyActivity.push({
      date: dateKey,
      label,
      completed: completedMap[dateKey] || 0,
      created: createdMap[dateKey] || 0,
    });
    cur.setDate(cur.getDate() + 1);
  }

  // Priority distribution counts
  const priorityDistribution = { NORMAL: 0, URGENT: 0, EMERGENCY: 0 };
  let priorityTotal = 0;
  priorityAgg.forEach((p) => {
    if (p._id && priorityDistribution[p._id] !== undefined) {
      priorityDistribution[p._id] = p.count;
      priorityTotal += p.count;
    }
  });

  // Service performance map
  const serviceMap = {};
  allServices.forEach((s) => {
    serviceMap[String(s._id)] = {
      serviceId: s._id,
      name: s.name,
      code: s.code,
      isActive: s.isActive,
      completed: 0,
    };
  });
  servicePerformanceAgg.forEach((item) => {
    if (serviceMap[String(item._id)]) {
      serviceMap[String(item._id)].completed = item.completed;
    }
  });
  const servicePerformance = Object.values(serviceMap).sort((a, b) => b.completed - a.completed);

  res.json({
    success: true,
    filter: {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      displayLabel:
        period === 'today'
          ? 'Today'
          : period === '7days'
          ? 'Last 7 Days'
          : period === '30days'
          ? 'Last 30 Days'
          : `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    },
    summary: {
      totalTokensToday,
      customersServedToday: servedToday,
      currentlyWaitingCustomers: currentlyWaiting,
      averageWaitingTimeToday: avgWaitMinutesToday,
      activeServices: activeServicesCount,
      emergencyTokensToday: emergencyToday,

      totalTokensPeriod,
      customersServedPeriod: servedPeriod,
      averageWaitingTimePeriod: avgWaitMinutesPeriod,
      emergencyTokensPeriod: emergencyPeriod,
    },
    dailyServed: dailyActivity.map((d) => ({
      date: d.date,
      label: d.label,
      completed: d.completed,
    })),
    dailyActivity,
    priorityDistribution: {
      ...priorityDistribution,
      total: priorityTotal,
    },
    servicePerformance,
  });
});
