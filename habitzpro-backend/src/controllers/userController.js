const path   = require('path');
const fs     = require('fs');
const User   = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// ── GET /api/users/profile ───────────────────────────────────
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, user });
});

// ── POST /api/users/avatar ───────────────────────────────────
// Handles multipart file upload via Multer
exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided.' });
  }

  const user = await User.findById(req.user.id);

  // Delete old avatar file if it exists on disk
  if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, '../../', user.avatarUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  // Build a URL path the frontend can use  →  /uploads/avatar_<id>_<ts>.jpg
  const relativePath = `/uploads/${req.file.filename}`;
  user.avatarUrl = relativePath;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success:   true,
    message:   'Avatar uploaded.',
    avatarUrl: relativePath,
  });
});

// ── DELETE /api/users/avatar ─────────────────────────────────
exports.removeAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '../../', user.avatarUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  user.avatarUrl = '';
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: 'Avatar removed.' });
});

// ── PUT /api/users/theme ─────────────────────────────────────
exports.updateTheme = asyncHandler(async (req, res) => {
  const { theme } = req.body;
  if (!['light', 'dark'].includes(theme)) {
    return res.status(400).json({ success: false, message: 'Theme must be "light" or "dark".' });
  }
  await User.findByIdAndUpdate(req.user.id, { theme });
  res.status(200).json({ success: true, message: 'Theme updated.', theme });
});

// ── DELETE /api/users/account ────────────────────────────────
exports.deleteAccount = asyncHandler(async (req, res) => {
  const Habit = require('../models/Habit');
  await Habit.deleteMany({ user: req.user.id });
  await User.findByIdAndDelete(req.user.id);
  res.status(200).json({ success: true, message: 'Account deleted.' });
});
