const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

// Backend models & controllers
const User = require('../models/User');
const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');
const Notification = require('../models/Notification');
const { getAnalytics } = require('../controllers/adminController');
const { setQueueStatus } = require('../controllers/staffController');
const { getEntryQueueInfo } = require('../utils/queueService');
const { authorize } = require('../middleware/auth');

const TEST_DB_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/priorityq_test';

// Helper to mock express req/res/next
function mockReqRes(options = {}) {
  const req = {
    user: options.user || null,
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
  };

  let errorPassed = null;

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };

  const next = (err) => {
    if (err) {
      errorPassed = err;
      res.statusCode = err.statusCode || 500;
      res.data = { message: err.message };
    }
  };

  return { req, res, next, getError: () => errorPassed };
}

test.before(async () => {
  await mongoose.connect(TEST_DB_URI);
  await mongoose.connection.dropDatabase();
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('Feature 4: Role Authorization - Customer and Staff cannot access admin analytics', async () => {
  const customer = { role: 'user', name: 'Cust' };
  const staff = { role: 'staff', name: 'Staff' };
  const adminMiddleware = authorize('admin');

  // Test customer
  const { req: reqC, res: resC, next: nextC, getError: getErrC } = mockReqRes({ user: customer });
  adminMiddleware(reqC, resC, nextC);
  assert.strictEqual(resC.statusCode, 403);
  assert.match(getErrC().message, /do not have permission/i);

  // Test staff
  const { req: reqS, res: resS, next: nextS, getError: getErrS } = mockReqRes({ user: staff });
  adminMiddleware(reqS, resS, nextS);
  assert.strictEqual(resS.statusCode, 403);
  assert.match(getErrS().message, /do not have permission/i);
});

test('Feature 4: Analytics returns safe empty defaults when no tokens exist', async () => {
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin_analytics@test.com',
    password: 'password123',
    role: 'admin',
    isActive: true,
  });

  const { req, res, next } = mockReqRes({ user: admin, query: { period: 'today' } });
  await getAnalytics(req, res, next);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.summary.totalTokensToday, 0);
  assert.strictEqual(res.data.summary.customersServedToday, 0);
  assert.strictEqual(res.data.summary.currentlyWaitingCustomers, 0);
  assert.strictEqual(res.data.summary.averageWaitingTimeToday, null, 'Average waiting time should be null (N/A) when empty');
  assert.strictEqual(res.data.summary.emergencyTokensToday, 0);
  assert.strictEqual(Array.isArray(res.data.dailyServed), true);
  assert.strictEqual(Array.isArray(res.data.dailyActivity), true);
  assert.strictEqual(res.data.priorityDistribution.total, 0);
  assert.deepStrictEqual(res.data.servicePerformance, []);
});

test('Feature 4: Analytics uses real MongoDB data, accurate wait time, and date filters', async () => {
  const serviceA = await Service.create({
    name: 'Billing & Payments',
    code: 'BIL',
    avgServiceMinutes: 10,
    queueStatus: 'OPEN',
    isActive: true,
  });

  const serviceB = await Service.create({
    name: 'Registration',
    code: 'REG',
    avgServiceMinutes: 15,
    queueStatus: 'OPEN',
    isActive: true,
  });

  const cust1 = await User.create({ name: 'Cust 1', email: 'c1@test.com', password: 'password123', role: 'user' });
  const cust2 = await User.create({ name: 'Cust 2', email: 'c2@test.com', password: 'password123', role: 'user' });
  const cust3 = await User.create({ name: 'Cust 3', email: 'c3@test.com', password: 'password123', role: 'user' });
  const cust4 = await User.create({ name: 'Cust 4', email: 'c4@test.com', password: 'password123', role: 'user' });

  const now = new Date();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  // 1. Token completed 2 days ago in Service A: wait time = 10 min
  await QueueEntry.create({
    user: cust1._id,
    service: serviceA._id,
    tokenNumber: 1,
    tokenLabel: 'BIL-001',
    priority: 'NORMAL',
    status: 'COMPLETED',
    joinedAt: new Date(twoDaysAgo.getTime() - 15 * 60000),
    calledAt: new Date(twoDaysAgo.getTime() - 5 * 60000),
    completedAt: twoDaysAgo,
    createdAt: twoDaysAgo,
  });

  // 2. Token completed TODAY in Service A: wait time = 20 min
  await QueueEntry.create({
    user: cust2._id,
    service: serviceA._id,
    tokenNumber: 2,
    tokenLabel: 'BIL-002',
    priority: 'URGENT',
    status: 'COMPLETED',
    joinedAt: new Date(now.getTime() - 30 * 60000),
    calledAt: new Date(now.getTime() - 10 * 60000),
    completedAt: now,
    createdAt: now,
  });

  // 3. Token completed TODAY in Service B using servingStartedAt: wait time = 40 min
  await QueueEntry.create({
    user: cust3._id,
    service: serviceB._id,
    tokenNumber: 1,
    tokenLabel: 'REG-001',
    priority: 'NORMAL',
    status: 'COMPLETED',
    joinedAt: new Date(now.getTime() - 50 * 60000),
    servingStartedAt: new Date(now.getTime() - 10 * 60000),
    completedAt: now,
    createdAt: now,
  });

  // 4. Token currently WAITING in Service A: EMERGENCY
  await QueueEntry.create({
    user: cust4._id,
    service: serviceA._id,
    tokenNumber: 3,
    tokenLabel: 'BIL-003',
    priority: 'EMERGENCY',
    status: 'WAITING',
    joinedAt: now,
    createdAt: now,
  });

  const admin = await User.findOne({ role: 'admin' });

  // Test 'today' filter
  const { req: reqToday, res: resToday, next: nextToday } = mockReqRes({ user: admin, query: { period: 'today' } });
  await getAnalytics(reqToday, resToday, nextToday);

  assert.strictEqual(resToday.statusCode, 200);
  const sumToday = resToday.data.summary;
  assert.strictEqual(sumToday.totalTokensToday, 3, '3 tokens created today');
  assert.strictEqual(sumToday.customersServedToday, 2, '2 tokens completed today');
  assert.strictEqual(sumToday.currentlyWaitingCustomers, 1, '1 token currently waiting');
  assert.strictEqual(sumToday.emergencyTokensToday, 1, '1 emergency token today');
  // Average waiting time today: (20 + 40) / 2 = 30 minutes
  assert.strictEqual(sumToday.averageWaitingTimeToday, 30, 'Average wait time today should be 30 minutes');

  // Test '7days' filter
  const { req: req7d, res: res7d, next: next7d } = mockReqRes({ user: admin, query: { period: '7days' } });
  await getAnalytics(req7d, res7d, next7d);

  assert.strictEqual(res7d.statusCode, 200);
  assert.strictEqual(res7d.data.summary.totalTokensPeriod, 4);
  assert.strictEqual(res7d.data.summary.customersServedPeriod, 3);
  assert.strictEqual(res7d.data.priorityDistribution.EMERGENCY, 1);
  assert.strictEqual(res7d.data.priorityDistribution.URGENT, 1);
  assert.strictEqual(res7d.data.priorityDistribution.NORMAL, 2);

  // Service performance: Service A (2 completed), Service B (1 completed)
  const perfA = res7d.data.servicePerformance.find((s) => s.code === 'BIL');
  const perfB = res7d.data.servicePerformance.find((s) => s.code === 'REG');
  assert.strictEqual(perfA.completed, 2);
  assert.strictEqual(perfB.completed, 1);

  // Test 'custom' date filter
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { req: reqCustom, res: resCustom, next: nextCustom } = mockReqRes({
    user: admin,
    query: { period: 'custom', startDate: yesterdayStr, endDate: tomorrowStr },
  });
  await getAnalytics(reqCustom, resCustom, nextCustom);
  assert.strictEqual(resCustom.statusCode, 200);
  assert.strictEqual(resCustom.data.summary.totalTokensPeriod, 3);
});

test('Feature 5: Unauthorized staff cannot pause another service queue', async () => {
  const serviceA = await Service.findOne({ code: 'BIL' });
  const serviceB = await Service.findOne({ code: 'REG' });

  const staffServiceA = await User.create({
    name: 'Staff Service A',
    email: 'staff_a@test.com',
    password: 'password123',
    role: 'staff',
    assignedService: serviceA._id,
    isActive: true,
  });

  const { req, res, next, getError } = mockReqRes({
    user: staffServiceA,
    params: { serviceId: serviceB._id.toString() },
    body: { status: 'PAUSED' },
  });

  await setQueueStatus(req, res, next);
  assert.strictEqual(res.statusCode, 403);
  assert.match(getError().message, /not authorized to manage this service/i);
});

test('Feature 5: Staff pauses queue successfully and notifies only affected customers', async () => {
  const serviceA = await Service.findOne({ code: 'BIL' });
  const serviceB = await Service.findOne({ code: 'REG' });
  const staffA = await User.findOne({ email: 'staff_a@test.com' });

  const custWaitingA = await User.create({ name: 'Waiting A', email: 'wait_a@test.com', password: 'password123', role: 'user', isActive: true });
  const custWaitingB = await User.create({ name: 'Waiting B', email: 'wait_b@test.com', password: 'password123', role: 'user', isActive: true });
  const custWaitingOther = await User.create({ name: 'Waiting Other', email: 'wait_other@test.com', password: 'password123', role: 'user', isActive: true });

  // Waiting in Service A
  const entryA = await QueueEntry.create({
    user: custWaitingA._id,
    service: serviceA._id,
    tokenNumber: 10,
    tokenLabel: 'BIL-010',
    priority: 'NORMAL',
    status: 'WAITING',
  });

  await QueueEntry.create({
    user: custWaitingB._id,
    service: serviceA._id,
    tokenNumber: 11,
    tokenLabel: 'BIL-011',
    priority: 'URGENT',
    status: 'WAITING',
  });

  // Waiting in Service B (Unrelated)
  await QueueEntry.create({
    user: custWaitingOther._id,
    service: serviceB._id,
    tokenNumber: 20,
    tokenLabel: 'REG-020',
    priority: 'NORMAL',
    status: 'WAITING',
  });

  // Clear previous notifications
  await Notification.deleteMany({});

  // Pause Service A
  const { req, res, next } = mockReqRes({
    user: staffA,
    params: { serviceId: serviceA._id.toString() },
    body: { status: 'PAUSED' },
  });

  await setQueueStatus(req, res, next);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.service.queueStatus, 'PAUSED');

  // Verify notifications
  const notifsA = await Notification.find({ user: custWaitingA._id });
  const notifsB = await Notification.find({ user: custWaitingB._id });
  const notifsOther = await Notification.find({ user: custWaitingOther._id });

  assert.strictEqual(notifsA.length, 1);
  assert.strictEqual(notifsA[0].type, 'QUEUE_PAUSED');
  assert.strictEqual(notifsA[0].title, 'Queue Temporarily Paused');
  assert.match(notifsA[0].message, /Billing & Payments/i);

  assert.strictEqual(notifsB.length, 1);
  assert.strictEqual(notifsB[0].type, 'QUEUE_PAUSED');

  assert.strictEqual(notifsOther.length, 0, 'Unrelated customer in Service B must NOT receive notification');

  // Verify Customer Dashboard queue info reflects pause & wait time unavailable
  const queueInfo = await getEntryQueueInfo(entryA);
  assert.strictEqual(queueInfo.isPaused, true);
  assert.strictEqual(queueInfo.queueStatus, 'PAUSED');
  assert.strictEqual(queueInfo.estimatedWaitMinutes, null, 'Estimated wait time must be null/unavailable when paused');
});

test('Feature 5: Repeated pause requests do not create duplicate notifications', async () => {
  const serviceA = await Service.findOne({ code: 'BIL' });
  const staffA = await User.findOne({ email: 'staff_a@test.com' });

  const countBefore = await Notification.countDocuments({ type: 'QUEUE_PAUSED' });

  // Call pause again when service is already PAUSED
  const { req, res, next } = mockReqRes({
    user: staffA,
    params: { serviceId: serviceA._id.toString() },
    body: { status: 'PAUSED' },
  });

  await setQueueStatus(req, res, next);
  assert.strictEqual(res.statusCode, 200);

  const countAfter = await Notification.countDocuments({ type: 'QUEUE_PAUSED' });
  assert.strictEqual(countAfter, countBefore, 'Repeated pause request must not create duplicate notifications');
});

test('Feature 5: Staff resumes queue successfully, sends resume notifications, and recalculates wait time', async () => {
  const serviceA = await Service.findOne({ code: 'BIL' });
  const staffA = await User.findOne({ email: 'staff_a@test.com' });
  const custWaitingA = await User.findOne({ email: 'wait_a@test.com' });
  const custWaitingOther = await User.findOne({ email: 'wait_other@test.com' });

  // Resume Service A
  const { req, res, next } = mockReqRes({
    user: staffA,
    params: { serviceId: serviceA._id.toString() },
    body: { status: 'OPEN' },
  });

  await setQueueStatus(req, res, next);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.service.queueStatus, 'OPEN');

  // Verify resume notifications
  const resumeNotifA = await Notification.findOne({ user: custWaitingA._id, type: 'QUEUE_RESUMED' });
  assert.ok(resumeNotifA, 'Affected customer must receive QUEUE_RESUMED notification');
  assert.strictEqual(resumeNotifA.title, 'Queue Resumed');
  assert.match(resumeNotifA.message, /Billing & Payments queue is now active/i);

  const resumeNotifOther = await Notification.findOne({ user: custWaitingOther._id, type: 'QUEUE_RESUMED' });
  assert.strictEqual(resumeNotifOther, null, 'Unrelated customer must not receive resume notification');

  // Verify wait time recalculation after resume
  const entryA = await QueueEntry.findOne({ user: custWaitingA._id, status: 'WAITING' });
  const queueInfo = await getEntryQueueInfo(entryA);
  assert.strictEqual(queueInfo.isPaused, false);
  assert.strictEqual(queueInfo.queueStatus, 'OPEN');
  assert.ok(typeof queueInfo.estimatedWaitMinutes === 'number' && queueInfo.estimatedWaitMinutes >= 0);
});

test('Feature 5: Repeated resume requests do not create duplicate notifications', async () => {
  const serviceA = await Service.findOne({ code: 'BIL' });
  const staffA = await User.findOne({ email: 'staff_a@test.com' });

  const countBefore = await Notification.countDocuments({ type: 'QUEUE_RESUMED' });

  // Call resume again when service is already OPEN
  const { req, res, next } = mockReqRes({
    user: staffA,
    params: { serviceId: serviceA._id.toString() },
    body: { status: 'OPEN' },
  });

  await setQueueStatus(req, res, next);
  assert.strictEqual(res.statusCode, 200);

  const countAfter = await Notification.countDocuments({ type: 'QUEUE_RESUMED' });
  assert.strictEqual(countAfter, countBefore, 'Repeated resume request must not create duplicate notifications');
});
