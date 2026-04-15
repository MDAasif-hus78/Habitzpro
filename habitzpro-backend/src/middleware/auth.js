const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — validates JWT from Authorization header or cookie.
 * Attaches req.user on success.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Bearer token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 2. Fallback: httpOnly cookie (if you later add cookie-based auth)
    else if (req.cookies && req.cookies.hp_token) {
      token = req.cookies.hp_token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorised — no token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'  ? 'Token expired — please sign in again.' :
      err.name === 'JsonWebTokenError'  ? 'Invalid token.'                          :
      'Not authorised.';
    return res.status(401).json({ success: false, message });
  }
};

module.exports = { protect };
