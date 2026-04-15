/**
 * Central error-handling middleware.
 * Always returns a consistent JSON shape:
 *   { success: false, message: "...", errors?: [...] }
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';
  let errors     = err.errors     || undefined;

  // Mongoose duplicate key (e.g. unique email)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A user with that ${field} already exists.`;
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors  = Object.values(err.errors).map((e) => e.message);
    message = 'Validation failed.';
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('🔴 Error:', err);
  }

  const response = { success: false, message };
  if (errors) response.errors = errors;

  res.status(statusCode).json(response);
};

/**
 * Async wrapper — eliminates try/catch boilerplate in controllers.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };
