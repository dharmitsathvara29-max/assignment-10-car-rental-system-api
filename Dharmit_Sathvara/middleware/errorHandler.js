/**
 * Centralized Express error-handling middleware
 * Ensures consistent JSON error responses across the API
 */
const errorHandler = (err, req, res, next) => {
  // Log unexpected errors in server console for debugging
  console.error('Unhandled Error:', err);

  const statusCode = err.statusCode || err.status || (res.statusCode >= 400 ? res.statusCode : 500);
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: message,
  });
};

module.exports = errorHandler;
