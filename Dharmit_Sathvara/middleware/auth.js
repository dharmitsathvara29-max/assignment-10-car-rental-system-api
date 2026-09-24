const supabase = require('../config/supabase');

/**
 * Middleware to verify Supabase JWT token from Authorization header
 * and attach the authenticated user object to req.user
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required. Format: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token missing from Authorization header',
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: error?.message || 'Invalid or expired token',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticateUser;
