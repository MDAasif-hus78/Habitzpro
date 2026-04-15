const express = require('express');
const router  = express.Router();

const {
  getProfile,
  uploadAvatar,
  removeAvatar,
  updateTheme,
  deleteAccount,
} = require('../controllers/userController');

const { protect } = require('../middleware/auth');
const upload      = require('../middleware/upload');

// All user routes require authentication
router.use(protect);

router.get   ('/profile',       getProfile);
router.post  ('/avatar',        upload.single('avatar'), uploadAvatar);
router.delete('/avatar',        removeAvatar);
router.put   ('/theme',         updateTheme);
router.delete('/account',       deleteAccount);

module.exports = router;
