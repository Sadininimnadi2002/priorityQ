// Run with:  npm run seed
// Creates demo services and accounts. Safe to run again (skips what already exists).
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Service = require('./models/Service');

const services = [
  { name: 'General Enquiry', code: 'GEN', description: 'Questions and general help', avgServiceMinutes: 5 },
  { name: 'Billing & Payments', code: 'BIL', description: 'Bills, payments and refunds', avgServiceMinutes: 8 },
  { name: 'Customer Support', code: 'SUP', description: 'Technical and account support', avgServiceMinutes: 10 },

  { name: 'Student Registration', code: 'REG', description: 'Registration and enrollment support', avgServiceMinutes: 7 },
  { name: 'Document Verification', code: 'DOC', description: 'Certificate and document verification', avgServiceMinutes: 6 },
  { name: 'IT Help Desk', code: 'IT', description: 'Computer, account and system support', avgServiceMinutes: 12 },
  { name: 'Library Services', code: 'LIB', description: 'Library membership, borrowing and account support', avgServiceMinutes: 5 },
  { name: 'Complaint Desk', code: 'CMP', description: 'Submit and discuss service-related complaints', avgServiceMinutes: 10 },
];

const accounts = [
  { name: 'System Admin', email: 'admin@priorityq.com', password: 'Admin@123', role: 'admin' },
  { name: 'Staff One', email: 'staff1@priorityq.com', password: 'Staff@123', role: 'staff', service: 'GEN' },
  { name: 'Staff Two', email: 'staff2@priorityq.com', password: 'Staff@123', role: 'staff', service: 'BIL' },
  { name: 'Demo Customer', email: 'user@priorityq.com', password: 'User@123', role: 'user' },
];

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in backend/.env');
    process.exit(1);
  }
  await connectDB();

  const byCode = {};
  for (const s of services) {
    let doc = await Service.findOne({ code: s.code });
    if (!doc) {
      doc = await Service.create(s);
      console.log(`Created service: ${s.name}`);
    }
    byCode[s.code] = doc;
  }

  for (const a of accounts) {
    const exists = await User.findOne({ email: a.email });
    if (exists) continue;
    await User.create({
      name: a.name,
      email: a.email,
      password: a.password,
      role: a.role,
      assignedService: a.service ? byCode[a.service]._id : null,
    });
    console.log(`Created ${a.role}: ${a.email} / ${a.password}`);
  }

  console.log('Seeding finished. Change these demo passwords before any real deployment.');
  await mongoose.connection.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
