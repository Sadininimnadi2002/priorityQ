// An Error that carries an HTTP status code, so controllers can simply:
//   throw new AppError('Not found', 404)
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

module.exports = AppError;
