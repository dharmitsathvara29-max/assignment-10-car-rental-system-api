const supabase = require('../config/supabase');

/**
 * Register a new user with Supabase Auth
 * POST /api/auth/register
 * Body: { email, password, name }
 */
const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // Sign up with Supabase Auth storing name in user metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim(),
        },
      },
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          name: data.user?.user_metadata?.name || name.trim(),
          created_at: data.user?.created_at,
        },
        session: data.session,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticate existing user and return Supabase JWT access token
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Sign in with password using Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        message: error.message || 'Invalid credentials',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        access_token: data.session?.access_token,
        token_type: 'Bearer',
        expires_in: data.session?.expires_in,
        user: {
          id: data.user?.id,
          email: data.user?.email,
          name: data.user?.user_metadata?.name || '',
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
};
