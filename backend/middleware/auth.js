const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const getTokenFromHeader = (req) => {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.split(' ')[1] : null;
};

// 1) AUTHENTICATION: "who are you?"  Verifies the JWT and attaches the user to req.user
const protect = asyncHandler(async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) throw new AppError('Not authorized, no token provided', 401);

  // Throws JsonWebTokenError / TokenExpiredError if invalid (handled in error middleware)
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id).populate('assignedService', 'name code isActive');
  if (!user) throw new AppError('The user for this token no longer exists', 401);
  if (!user.isActive) throw new AppError('This account has been deactivated', 403);

  req.user = user;
  next();
});

// 2) AUTHORIZATION: "are you allowed?"  Use after protect: authorize('admin', 'staff')
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };

// For public routes that behave differently for logged-in users. Never blocks the request.
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && user.isActive) req.user = user;
    } catch (err) {
      // invalid token on a public route: just continue as a guest
    }
  }
  next();
});

module.exports = { protect, authorize, optionalAuth };
