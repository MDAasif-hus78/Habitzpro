const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

// ── Validation helpers ───────────────────────────────────────
const validateRegister = [
  body('firstName').trim().notEmpty().withMessage('First name is required.'),
  body('lastName').trim().notEmpty().withMessage('Last name is required.'),
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
];

const validateLogin = [
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

// Middleware: check express-validator results
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors:  errors.array().map((e) => e.msg),
    });
  }
  next();
};

// ── Routes ───────────────────────────────────────────────────
router.post('/register',         validateRegister, validate, register);
router.post('/login',            validateLogin,    validate, login);
router.get ('/me',               protect, getMe);
router.put ('/update-profile',   protect, updateProfile);
router.put ('/change-password',  protect, changePassword);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password',   resetPassword);
router.post('/logout',           protect, logout);

module.exports = router;
