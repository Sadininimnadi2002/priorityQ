const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

// Models
const User = require('../models/User');
const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');
const PriorityLog = require('../models/PriorityLog');
const { ALLOWED_TRANSITIONS } = require('../utils/constants');

const TEST_DB_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/priorityq_test_staff_ops';

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

test('State machine transitions: ALLOWED_TRANSITIONS strictly matches rules', () => {
  assert.deepStrictEqual(ALLOWED_TRANSITIONS.WAITING, ['CALLED', 'SKIPPED', 'CANCELLED']);
  assert.deepStrictEqual(ALLOWED_TRANSITIONS.CALLED, ['SERVING', 'SKIPPED', 'CANCELLED']);
  assert.deepStrictEqual(ALLOWED_TRANSITIONS.SERVING, ['COMPLETED']);
  assert.deepStrictEqual(ALLOWED_TRANSITIONS.SKIPPED, ['WAITING']);
  assert.deepStrictEqual(ALLOWED_TRANSITIONS.COMPLETED, []);
  assert.deepStrictEqual(ALLOWED_TRANSITIONS.CANCELLED, []);
});

test('Call Next, Start Service, Complete Service lifecycle', async () => {
  const staff = await User.create({
    name: 'Staff Alice',
    email: 'alice@test.com',
    password: 'password123',
    role: 'staff',
  });

  const user = await User.create({
    name: 'Customer Bob',
    email: 'bob@test.com',
    password: 'password123',
    role: 'user',
  });

  const service = await Service.create({
    name: 'Test Service 1',
    code: 'TSA',
    avgServiceMinutes: 5,
    queueStatus: 'OPEN',
  });

  // Create waiting entry
  const entry = await QueueEntry.create({
    service: service._id,
    user: user._id,
    tokenNumber: 1,
    tokenLabel: 'TS1-001',
    priority: 'NORMAL',
    status: 'WAITING',
    joinedAt: new Date(),
  });

  // 1. Call Next / Call Token -> transition to CALLED
  assert.strictEqual(entry.canMoveTo('CALLED'), true);
  const called = await QueueEntry.findOneAndUpdate(
    { _id: entry._id, status: 'WAITING' },
    { $set: { status: 'CALLED', calledAt: new Date(), handledBy: staff._id } },
    { new: true }
  );
  assert.ok(called);
  assert.strictEqual(called.status, 'CALLED');
  assert.ok(called.calledAt);
  assert.strictEqual(String(called.handledBy), String(staff._id));

  // Cannot call twice
  const doubleCall = await QueueEntry.findOneAndUpdate(
    { _id: entry._id, status: 'WAITING' },
    { $set: { status: 'CALLED' } }
  );
  assert.strictEqual(doubleCall, null);

  // Cannot jump directly from CALLED to COMPLETED
  assert.strictEqual(called.canMoveTo('COMPLETED'), false);

  // 2. Start Service -> transition from CALLED to SERVING
  assert.strictEqual(called.canMoveTo('SERVING'), true);
  const serving = await QueueEntry.findOneAndUpdate(
    { _id: called._id, status: 'CALLED' },
    { $set: { status: 'SERVING', servingStartedAt: new Date(), handledBy: staff._id } },
    { new: true }
  );
  assert.ok(serving);
  assert.strictEqual(serving.status, 'SERVING');
  assert.ok(serving.servingStartedAt);

  // 3. Complete Service -> transition from SERVING to COMPLETED
  assert.strictEqual(serving.canMoveTo('COMPLETED'), true);
  const completed = await QueueEntry.findOneAndUpdate(
    { _id: serving._id, status: 'SERVING' },
    { $set: { status: 'COMPLETED', completedAt: new Date() } },
    { new: true }
  );
  assert.ok(completed);
  assert.strictEqual(completed.status, 'COMPLETED');
  assert.ok(completed.completedAt);

  // Completed token is terminal
  assert.strictEqual(completed.canMoveTo('WAITING'), false);
  assert.strictEqual(completed.canMoveTo('CALLED'), false);
  assert.strictEqual(completed.canMoveTo('SKIPPED'), false);
});

test('Skip and Restore Customer workflow', async () => {
  const staff = await User.create({
    name: 'Staff Charlie',
    email: 'charlie@test.com',
    password: 'password123',
    role: 'staff',
  });

  const user = await User.create({
    name: 'Customer Dave',
    email: 'dave@test.com',
    password: 'password123',
    role: 'user',
  });

  const service = await Service.create({
    name: 'Test Service 2',
    code: 'TSB',
    avgServiceMinutes: 10,
    queueStatus: 'OPEN',
  });

  const originalJoinedAt = new Date(Date.now() - 30 * 60000);
  const entry = await QueueEntry.create({
    service: service._id,
    user: user._id,
    tokenNumber: 42,
    tokenLabel: 'TS2-042',
    priority: 'URGENT',
    status: 'CALLED',
    joinedAt: originalJoinedAt,
    calledAt: new Date(),
    handledBy: staff._id,
  });

  // Skip
  assert.strictEqual(entry.canMoveTo('SKIPPED'), true);
  const skipped = await QueueEntry.findOneAndUpdate(
    { _id: entry._id, status: { $in: ['CALLED', 'WAITING'] } },
    { $set: { status: 'SKIPPED', skippedAt: new Date(), handledBy: staff._id } },
    { new: true }
  );
  assert.ok(skipped);
  assert.strictEqual(skipped.status, 'SKIPPED');
  assert.ok(skipped.skippedAt);

  // Restore to WAITING
  assert.strictEqual(skipped.canMoveTo('WAITING'), true);
  const restored = await QueueEntry.findOneAndUpdate(
    { _id: skipped._id, status: 'SKIPPED' },
    { $set: { status: 'WAITING', calledAt: null, skippedAt: null } },
    { new: true }
  );
  assert.ok(restored);
  assert.strictEqual(restored.status, 'WAITING');
  assert.strictEqual(restored.tokenNumber, 42); // original token number preserved
  assert.strictEqual(restored.tokenLabel, 'TS2-042');
  assert.strictEqual(restored.priority, 'URGENT'); // original priority preserved
  assert.strictEqual(restored.joinedAt.getTime(), originalJoinedAt.getTime()); // original join time preserved
  assert.strictEqual(restored.calledAt, null);
  assert.strictEqual(restored.skippedAt, null);
});

test('Restore rejected if customer joined another active queue', async () => {
  const user = await User.create({
    name: 'Customer Eve',
    email: 'eve@test.com',
    password: 'password123',
    role: 'user',
  });

  const svc1 = await Service.create({ name: 'Svc A', code: 'SVA' });
  const svc2 = await Service.create({ name: 'Svc B', code: 'SVB' });

  // Token 1 in Svc A was skipped
  const skippedEntry = await QueueEntry.create({
    service: svc1._id,
    user: user._id,
    tokenNumber: 1,
    tokenLabel: 'SVA-001',
    status: 'SKIPPED',
    skippedAt: new Date(),
  });

  // Token 2 in Svc B is active (WAITING)
  await QueueEntry.create({
    service: svc2._id,
    user: user._id,
    tokenNumber: 1,
    tokenLabel: 'SVB-001',
    status: 'WAITING',
  });

  // Check before restoring
  const activeOther = await QueueEntry.findOne({
    user: user._id,
    status: { $in: ['WAITING', 'CALLED', 'SERVING'] },
    _id: { $ne: skippedEntry._id },
  });
  assert.ok(activeOther, 'Should detect another active token for Eve');
});

test('Prevent duplicate active tokens for same user via partial unique index', async () => {
  const user = await User.create({
    name: 'Customer Frank',
    email: 'frank@test.com',
    password: 'password123',
    role: 'user',
  });

  const service = await Service.create({ name: 'Svc C', code: 'SVC' });

  // Ensure indexes are built
  await QueueEntry.syncIndexes();

  // First active token
  await QueueEntry.create({
    service: service._id,
    user: user._id,
    tokenNumber: 1,
    tokenLabel: 'SVC-001',
    status: 'WAITING',
  });

  // Attempting second active token concurrently should fail with duplicate key error (11000)
  await assert.rejects(
    async () => {
      await QueueEntry.create({
        service: service._id,
        user: user._id,
        tokenNumber: 2,
        tokenLabel: 'SVC-002',
        status: 'WAITING',
      });
    },
    (err) => err.code === 11000
  );
});

test('Queue controls: Paused and Closed status validation', async () => {
  const service = await Service.create({
    name: 'Controlled Svc',
    code: 'CS',
    queueStatus: 'PAUSED',
  });

  assert.strictEqual(service.queueStatus, 'PAUSED');

  // Resume queue
  service.queueStatus = 'OPEN';
  await service.save();
  assert.strictEqual(service.queueStatus, 'OPEN');

  // Close queue
  service.queueStatus = 'CLOSED';
  await service.save();
  assert.strictEqual(service.queueStatus, 'CLOSED');
});
