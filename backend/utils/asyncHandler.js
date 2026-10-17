// Express 4 does not catch errors thrown inside async functions.
// This wrapper sends any error to our central error handler via next(err).
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
