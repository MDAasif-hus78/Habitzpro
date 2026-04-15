const express = require('express');
const router  = express.Router();

const {
  getHabits,
  getHabit,
  createHabit,
  updateHabit,
  deleteHabit,
  archiveHabit,
  toggleToday,
  toggleDate,
  toggleChartCell,
  updateGoal,
  getAnalytics,
  getAchievements,
} = require('../controllers/habitController');

const { protect } = require('../middleware/auth');

// All habit routes require authentication
router.use(protect);

// Analytics (must come before /:id routes)
router.get('/analytics/summary',      getAnalytics);
router.get('/analytics/achievements', getAchievements);

// CRUD
router.route('/')
  .get(getHabits)
  .post(createHabit);

router.route('/:id')
  .get(getHabit)
  .put(updateHabit)
  .delete(deleteHabit);

// Actions
router.patch('/:id/archive',    archiveHabit);
router.patch('/:id/toggle',     toggleToday);
router.patch('/:id/date',       toggleDate);
router.patch('/:id/chart-cell', toggleChartCell);
router.patch('/:id/goal',       updateGoal);

module.exports = router;
