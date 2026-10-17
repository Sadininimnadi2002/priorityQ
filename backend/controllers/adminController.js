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

  const [totalUsers, totalStaff, totalServices, activeServiceIds, totalWaiting, usersServedToday, waitAgg] =
    await Promise.all([
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
    ]);

  const avgWaitingMinutes = waitAgg.length ? Math.round((waitAgg[0].avgMs / 60000) * 10) / 10 : 0;

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

  res.json({
    success: true,
    days,
    since,
    byDay: byDay.map((d) => ({
      date: d._id,
      completed: d.completed,
      avgWaitMinutes: Math.round((d.avgWaitMs / 60000) * 10) / 10,
    })),
    byService: Object.values(byServiceMap),
    byPriority: byPriority.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), { EMERGENCY: 0, URGENT: 0, NORMAL: 0 }),
  });
});
