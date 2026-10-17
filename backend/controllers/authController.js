const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const generateToken = require('../utils/generateToken');

// POST /api/auth/register  (public)  -> always creates a normal "user"
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new AppError('Email is already registered', 409);

  // NOTE: role is NOT taken from req.body, so nobody can register themselves as admin
  const user = await User.create({ name, email, password, phone });

  res.status(201).json({ success: true, token: generateToken(user._id), user });
});

// POST /api/auth/login  (public)
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  // Same message for "no such email" and "wrong password" so attackers learn nothing
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.isActive) throw new AppError('This account has been deactivated', 403);

  await user.populate('assignedService', 'name code isActive');
  res.json({ success: true, token: generateToken(user._id), user });
});

// GET /api/auth/me  (logged in)
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// PUT /api/auth/me  (logged in) - update own profile / change password
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, phone, currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;

  if (newPassword) {
    if (!currentPassword || !(await user.matchPassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 400);
    }
    user.password = newPassword; // hashed automatically in the pre-save hook
  }

  await user.save();
  await user.populate('assignedService', 'name code isActive');
  res.json({ success: true, user });
});
