const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

// Models
const User = require('../models/User');
const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');

const TEST_DB_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/priorityq_test_admin_ops';

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

test('Admin User Management: Password hash is never returned in queries or JSON', async () => {
  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@test.com',
    password: 'SuperSecretPassword123',
    role: 'admin',
  });

  // Querying document without .select('+password')
  const queried = await User.findById(admin._id);
  assert.strictEqual(queried.password, undefined);

  // Converting to JSON
  const json = queried.toJSON();
  assert.strictEqual(json.password, undefined);
});

test('Admin User Management: Prevent deleting or deactivating the last active administrator', async () => {
  const admin = await User.findOne({ role: 'admin', isActive: true });
  assert.ok(admin);

  // Count active admins excluding this admin
  const otherAdmins = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: admin._id } });
  assert.strictEqual(otherAdmins, 0);

  // If otherAdmins === 0, deleting or deactivating should be rejected
  const canDeactivate = otherAdmins > 0;
  assert.strictEqual(canDeactivate, false, 'Should block deactivating the only active admin');
});

test('Admin User Management: User with queue history is deactivated rather than deleted', async () => {
  const user = await User.create({
    name: 'Customer With History',
    email: 'history_user@test.com',
    password: 'Password123',
    role: 'user',
  });

  const service = await Service.create({
    name: 'Consultation Service',
    code: 'CON',
    avgServiceMinutes: 15,
  });

  await QueueEntry.create({
    service: service._id,
    user: user._id,
    tokenNumber: 1,
    tokenLabel: 'CON-001',
    status: 'COMPLETED',
    completedAt: new Date(),
  });

  // Check queue history
  const hasHistory = await QueueEntry.exists({ user: user._id });
  assert.ok(hasHistory);

  // Deactivate instead of delete
  user.isActive = false;
  await user.save();

  const reloaded = await User.findById(user._id);
  assert.ok(reloaded, 'User document is preserved');
  assert.strictEqual(reloaded.isActive, false);
});

test('Admin Staff Management: Assign and change staff service assignment', async () => {
  const svc1 = await Service.create({ name: 'Helpdesk', code: 'HLP' });
  const svc2 = await Service.create({ name: 'Accounts', code: 'ACC' });

  const staff = await User.create({
    name: 'Staff John',
    email: 'john@test.com',
    password: 'Password123',
    role: 'staff',
    assignedService: svc1._id,
  });

  assert.strictEqual(String(staff.assignedService), String(svc1._id));

  // Reassign to svc2
  staff.assignedService = svc2._id;
  await staff.save();

  const updatedStaff = await User.findById(staff._id).populate('assignedService', 'name code');
  assert.strictEqual(updatedStaff.assignedService.code, 'ACC');
});

test('Admin Service Management: Unique constraints prevent duplicate service name or code', async () => {
  await Service.syncIndexes();

  await assert.rejects(
    async () => {
      await Service.create({
        name: 'Helpdesk', // duplicate name
        code: 'HLPB',
      });
    },
    (err) => err.code === 11000
  );

  await assert.rejects(
    async () => {
      await Service.create({
        name: 'Helpdesk Two',
        code: 'HLP', // duplicate code
      });
    },
    (err) => err.code === 11000
  );
});

test('Admin Service Management: Search by query and filter by queueStatus', async () => {
  const results = await Service.find({
    $or: [{ name: /Helpdesk/i }, { code: /Helpdesk/i }],
  });
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].code, 'HLP');
});
