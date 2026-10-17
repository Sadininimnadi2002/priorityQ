const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ROLES, PRIORITIES } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned by queries unless asked with .select('+password')
    },
    phone: { type: String, trim: true, default: '' },
    role: { type: String, enum: ROLES, default: 'user' },
    // Priority given automatically when this user joins a queue (admin can change it,
    // e.g. for elderly or disabled customers). Staff can still change it per token.
    defaultPriority: { type: String, enum: PRIORITIES, default: 'NORMAL' },
    // Only used for staff: the service they work on (reference to the services collection)
    assignedService: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

// Runs before every save. Only re-hash when the password was changed.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// Make sure the password hash is never sent in a JSON response
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
