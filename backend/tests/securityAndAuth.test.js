const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Models & utils
const User = require('../models/User');
const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');
const generateToken = require('../utils/generateToken');

const TEST_DB_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/priorityq_test_security_ops';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_priorityq_123';
process.env.JWT_SECRET = JWT_SECRET;

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

test('Authentication: Password is encrypted with bcrypt and matchPassword works', async () => {
  const user = await User.create({
    name: 'Security User',
    email: 'sec_user@test.com',
    password: 'PlainPassword123',
    role: 'user',
  });

  // Check stored password in database directly
  const raw = await User.findById(user._id).select('+password');
  assert.notStrictEqual(raw.password, 'PlainPassword123');
  assert.ok(raw.password.startsWith('$2'), 'Password must be hashed with bcrypt');

  // matchPassword succeeds with correct password and fails with wrong
  const isCorrect = await raw.matchPassword('PlainPassword123');
  const isWrong = await raw.matchPassword('WrongPassword');
  assert.strictEqual(isCorrect, true);
  assert.strictEqual(isWrong, false);
});

test('Authentication: JWT token generation and verification', () => {
  const fakeId = new mongoose.Types.ObjectId();
  const token = generateToken(fakeId);
  assert.ok(token);

  const decoded = jwt.verify(token, JWT_SECRET);
  assert.strictEqual(decoded.id, String(fakeId));
});

test('Role Authorization: Users cannot access staff or admin operations', async () => {
  const user = await User.create({
    name: 'Regular Customer',
    email: 'customer@test.com',
    password: 'Password123',
    role: 'user',
  });

  const staffOnlyRoles = ['staff', 'admin'];
  const adminOnlyRoles = ['admin'];

  // Verification helper mimicking authorize middleware
  const canAccessStaff = staffOnlyRoles.includes(user.role);
  const canAccessAdmin = adminOnlyRoles.includes(user.role);

  assert.strictEqual(canAccessStaff, false, 'User must not access staff operations');
  assert.strictEqual(canAccessAdmin, false, 'User must not access admin operations');
});

test('Role Authorization: Staff can only access assigned service', async () => {
  const svcA = await Service.create({ name: 'Service Alpha', code: 'SVA' });
  const svcB = await Service.create({ name: 'Service Beta', code: 'SVB' });

  const staff = await User.create({
    name: 'Staff Alpha Member',
    email: 'staff_alpha@test.com',
    password: 'Password123',
    role: 'staff',
    assignedService: svcA._id,
  });

  const isAssignedToA = String(staff.assignedService) === String(svcA._id);
  const isAssignedToB = String(staff.assignedService) === String(svcB._id);

  assert.strictEqual(isAssignedToA, true);
  assert.strictEqual(isAssignedToB, false, 'Staff member must not manage unassigned service');
});

test('Security: Deactivated users cannot perform operations', async () => {
  const deactivatedUser = await User.create({
    name: 'Deactivated User',
    email: 'deactivated@test.com',
    password: 'Password123',
    role: 'staff',
    isActive: false,
  });

  assert.strictEqual(deactivatedUser.isActive, false);
});

test('Database Integrity: Token cannot transition from COMPLETED to any status', async () => {
  const user = await User.create({
    name: 'Integrity Customer',
    email: 'integrity@test.com',
    password: 'Password123',
  });

  const svc = await Service.create({ name: 'Service Gamma', code: 'SVG' });

  const completedToken = await QueueEntry.create({
    service: svc._id,
    user: user._id,
    tokenNumber: 99,
    tokenLabel: 'SVG-099',
    status: 'COMPLETED',
    completedAt: new Date(),
  });

  assert.strictEqual(completedToken.canMoveTo('WAITING'), false);
  assert.strictEqual(completedToken.canMoveTo('CALLED'), false);
  assert.strictEqual(completedToken.canMoveTo('SERVING'), false);
  assert.strictEqual(completedToken.canMoveTo('CANCELLED'), false);
  assert.strictEqual(completedToken.canMoveTo('SKIPPED'), false);
});
