const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Helper: sign JWT ─────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── Helper: send token response ──────────────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:          user._id,
      firstName:   user.firstName,
      lastName:    user.lastName,
      displayName: user.displayName || user.fullName,
      email:       user.email,
      bio:         user.bio,
      avatarUrl:   user.avatarUrl,
      theme:       user.theme,
      initials:    user.initials,
      createdAt:   user.createdAt,
    },
  });
};

// ── POST /api/auth/register ──────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
  }

  const user = await User.create({ firstName, lastName, email, password });
  sendTokenResponse(user, 201, res);
});

// ── POST /api/auth/login ─────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const match = await user.comparePassword(password);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  sendTokenResponse(user, 200, res);
});

// ── GET /api/auth/me ─────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    success: true,
    user: {
      id:          user._id,
      firstName:   user.firstName,
      lastName:    user.lastName,
      displayName: user.displayName || user.fullName,
      email:       user.email,
      bio:         user.bio,
      avatarUrl:   user.avatarUrl,
      theme:       user.theme,
      initials:    user.initials,
      createdAt:   user.createdAt,
    },
  });
});

// ── PUT /api/auth/update-profile ─────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, displayName, email, bio, theme } = req.body;

  const updates = {};
  if (firstName)   updates.firstName   = firstName.trim();
  if (lastName)    updates.lastName    = lastName.trim();
  if (displayName !== undefined) updates.displayName = displayName.trim();
  if (email)       updates.email       = email.toLowerCase().trim();
  if (bio  !== undefined) updates.bio  = bio.trim();
  if (theme && ['light','dark'].includes(theme)) updates.theme = theme;

  // Check email uniqueness if changed
  if (updates.email && updates.email !== req.user.email) {
    const exists = await User.findOne({ email: updates.email });
    if (exists) {
      return res.status(409).json({ success: false, message: 'That email is already in use.' });
    }
  }

  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });

  res.status(200).json({
    success: true,
    message: 'Profile updated.',
    user: {
      id:          user._id,
      firstName:   user.firstName,
      lastName:    user.lastName,
      displayName: user.displayName || user.fullName,
      email:       user.email,
      bio:         user.bio,
      avatarUrl:   user.avatarUrl,
      theme:       user.theme,
      initials:    user.initials,
    },
  });
});

// ── PUT /api/auth/change-password ────────────────────────────
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  const user = await User.findById(req.user.id).select('+password');
  const match = await user.comparePassword(currentPassword);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({ success: true, message: 'Password changed successfully.' });
});

// ── POST /api/auth/forgot-password ──────────────────────────
// In production: send email with reset link. Here we return the token directly
// so you can wire it to your email service (SendGrid, Nodemailer, etc.)
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });

  // Always respond 200 to prevent email enumeration
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If an account exists for that email, a reset code has been sent.',
    });
  }

  // Generate 6-digit code
  const rawCode    = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = crypto.createHash('sha256').update(rawCode).digest('hex');

  user.resetPasswordToken   = hashedCode;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  await user.save({ validateBeforeSave: false });

  // ⚠️  TODO: Replace with real email delivery (Nodemailer / SendGrid):
  //   await sendEmail({ to: user.email, subject: 'Your HabitzPro reset code', text: `Code: ${rawCode}` });

  // For development: return the raw code in the response
  const responsePayload = {
    success: true,
    message: 'If an account exists for that email, a reset code has been sent.',
  };
  if (process.env.NODE_ENV === 'development') {
    responsePayload._devCode = rawCode; // remove in production
  }

  res.status(200).json(responsePayload);
});

// ── POST /api/auth/reset-password ───────────────────────────
exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, code, and new password are required.' });
  }

  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

  const user = await User.findOne({
    email:                (email || '').toLowerCase(),
    resetPasswordToken:   hashedCode,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
  }

  user.password             = newPassword;
  user.resetPasswordToken   = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// ── POST /api/auth/logout ────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  // JWT is stateless — client simply deletes the token.
  // If you add cookie-based auth later, clear the cookie here.
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});
