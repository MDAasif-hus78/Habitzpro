const Habit = require('../models/Habit');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Helper ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

// ── GET /api/habits ──────────────────────────────────────────
// Returns all non-archived habits for the logged-in user
exports.getHabits = asyncHandler(async (req, res) => {
  const { category, search, archived } = req.query;

  const filter = { user: req.user.id };
  if (archived === 'true') filter.isArchived = true;
  else filter.isArchived = false;

  if (category) filter.category = category;
  if (search)   filter.name     = { $regex: search, $options: 'i' };

  const habits = await Habit.find(filter).sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: habits.length, habits });
});

// ── GET /api/habits/:id ──────────────────────────────────────
exports.getHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, user: req.user.id });
  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found.' });
  }
  res.status(200).json({ success: true, habit });
});

// ── POST /api/habits ─────────────────────────────────────────
exports.createHabit = asyncHandler(async (req, res) => {
  const { name, emoji, category, note, goal } = req.body;

  // Prevent duplicates (index enforces it, but give a friendly message)
  const existing = await Habit.findOne({ user: req.user.id, name: name.trim(), isArchived: false });
  if (existing) {
    return res.status(409).json({ success: false, message: 'You already have a habit with that name.' });
  }

  const habit = await Habit.create({
    user: req.user.id,
    name: name.trim(),
    emoji:    emoji    || '⭐',
    category: category || 'Health',
    note:     note     || '',
    goal:     goal     || 30,
  });

  res.status(201).json({ success: true, habit });
});

// ── PUT /api/habits/:id ──────────────────────────────────────
exports.updateHabit = asyncHandler(async (req, res) => {
  const { name, emoji, category, note, goal } = req.body;

  const habit = await Habit.findOne({ _id: req.params.id, user: req.user.id });
  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found.' });
  }

  if (name)      habit.name     = name.trim();
  if (emoji)     habit.emoji    = emoji;
  if (category)  habit.category = category;
  if (note !== undefined)  habit.note     = note.trim();
  if (goal)      habit.goal     = goal;

  await habit.save();
  res.status(200).json({ success: true, habit });
});

// ── DELETE /api/habits/:id ───────────────────────────────────
exports.deleteHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found.' });
  }
  res.status(200).json({ success: true, message: 'Habit deleted.' });
});

// ── PATCH /api/habits/:id/archive ───────────────────────────
exports.archiveHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, user: req.user.id });
  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found.' });
  }
  habit.isArchived = !habit.isArchived;
  await habit.save();
  res.status(200).json({ success: true, isArchived: habit.isArchived, habit });
});

// ── PATCH /api/habits/:id/toggle ─────────────────────────────
// Toggles today's completion for a habit
exports.toggleToday = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, user: req.user.id });
  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found.' });
  }

  const todayStr = today();
  const idx      = habit.completedDates.indexOf(todayStr);

  if (idx === -1) {
    habit.completedDates.push(todayStr);
  } else {
    habit.completedDates.splice(idx, 1);
  }

  // Recompute streak
  habit.streak = Habit.computeStreak(habit.completedDates);
  await habit.save();

  res.status(200).json({
    success: true,
    completed: habit.completedDates.includes(todayStr),
    streak:    habit.streak,
    habit,
  });
});

// ── PATCH /api/habits/:id/complete-date ──────────────────────
// Toggle a specific date (not just today) — used by the tracker chart
exports.toggleDate = asyncHandler(async (req, res) => {
  const { date } = req.body; // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'Provide a valid date (YYYY-MM-DD).' });
  }

  const habit = await Habit.findOne({ _id: req.params.id, user: req.user.id });
  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found.' });
  }

  const idx = habit.completedDates.indexOf(date);
  if (idx === -1) habit.completedDates.push(date);
  else            habit.completedDates.splice(idx, 1);

  habit.streak = Habit.computeStreak(habit.completedDates);
  await habit.save();

  res.status(200).json({
    success:   true,
    completed: habit.completedDates.includes(date),
    streak:    habit.streak,
    habit,
  });
});

// ── PATCH /api/habits/:id/chart-cell ─────────────────────────
// Toggle a cell in the monthly tracking chart grid
exports.toggleChartCell = asyncHandler(async (req, res) => {
  const { year, month, day } = req.body;

  if (year == null || month == null || day == null) {
    return res.status(400).json({ success: false, message: 'year, month, and day are required.' });
  }

  const habit = await Habit.findOne({ _id: req.params.id, user: req.user.id });
  if (!habit) {
    return res.status(404).json({ success: false, message: 'Habit not found.' });
  }

  // Find existing cell
  const cellIdx = habit.chartCells.findIndex(
    (c) => c.year === year && c.month === month && c.day === day
  );

  if (cellIdx === -1) {
    habit.chartCells.push({ year, month, day, ticked: true });
  } else {
    habit.chartCells[cellIdx].ticked = !habit.chartCells[cellIdx].ticked;
  }

  await habit.save();

  const cell = habit.chartCells.find((c) => c.year === year && c.month === month && c.day === day);
  res.status(200).json({ success: true, ticked: cell ? cell.ticked : false });
});

// ── PATCH /api/habits/:id/goal ───────────────────────────────
exports.updateGoal = asyncHandler(async (req, res) => {
  const { goal } = req.body;
  if (!goal || isNaN(goal) || goal < 1) {
    return res.status(400).json({ success: false, message: 'Goal must be a positive number.' });
  }

  const habit = await Habit.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { goal },
    { new: true }
  );
  if (!habit) return res.status(404).json({ success: false, message: 'Habit not found.' });

  res.status(200).json({ success: true, goal: habit.goal, habit });
});

// ── GET /api/habits/analytics/summary ────────────────────────
// Aggregated stats for the Analytics section
exports.getAnalytics = asyncHandler(async (req, res) => {
  const habits = await Habit.find({ user: req.user.id, isArchived: false });
  const todayStr = today();

  // Today's stats
  const totalToday    = habits.length;
  const completedToday = habits.filter((h) => h.completedDates.includes(todayStr)).length;
  const completionRate = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;
  const bestStreak     = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);

  // Last 7 days
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d    = new Date();
    d.setDate(d.getDate() - i);
    const ds   = d.toISOString().split('T')[0];
    const done = habits.filter((h) => h.completedDates.includes(ds)).length;
    last7.push({ date: ds, completed: done, total: totalToday });
  }

  // Last 4 weeks
  const last4weeks = [];
  for (let w = 3; w >= 0; w--) {
    let weekTotal = 0;
    const start = new Date();
    start.setDate(start.getDate() - w * 7 - 6);
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + d);
      const ds = day.toISOString().split('T')[0];
      weekTotal += habits.filter((h) => h.completedDates.includes(ds)).length;
    }
    last4weeks.push({ week: `W${4 - w}`, completed: weekTotal });
  }

  // Last 6 months
  const last6months = [];
  for (let m = 5; m >= 0; m--) {
    const ref = new Date();
    ref.setMonth(ref.getMonth() - m);
    const yr = ref.getFullYear();
    const mo = ref.getMonth();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    let monthTotal = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      monthTotal += habits.filter((h) => h.completedDates.includes(ds)).length;
    }
    last6months.push({
      month: ref.toLocaleString('en-US', { month: 'short' }),
      completed: monthTotal,
    });
  }

  // Per-habit breakdown
  const habitStats = habits.map((h) => ({
    id:             h._id,
    name:           h.name,
    emoji:          h.emoji,
    category:       h.category,
    streak:         h.streak,
    totalCompleted: h.completedDates.length,
    completedToday: h.completedDates.includes(todayStr),
  }));

  res.status(200).json({
    success: true,
    analytics: {
      totalHabits:    totalToday,
      completedToday,
      completionRate,
      bestStreak,
      last7Days:      last7,
      last4Weeks:     last4weeks,
      last6Months:    last6months,
      habitBreakdown: habitStats,
    },
  });
});

// ── GET /api/habits/analytics/achievements ───────────────────
exports.getAchievements = asyncHandler(async (req, res) => {
  const habits   = await Habit.find({ user: req.user.id, isArchived: false });
  const todayStr = today();

  const totalCompleted = habits.reduce((s, h) => s + h.completedDates.length, 0);
  const bestStreak     = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);
  const completedToday = habits.filter((h) => h.completedDates.includes(todayStr));

  // Milestone definitions (mirrors frontend)
  const milestones = [
    { id: 'first_habit',    emoji: '🌱', title: 'First Habit',       desc: 'Created your first habit',          unlocked: habits.length >= 1              },
    { id: 'streak_3',       emoji: '🔥', title: '3-Day Streak',      desc: 'Kept a habit going for 3 days',     unlocked: bestStreak >= 3                  },
    { id: 'streak_7',       emoji: '⚡', title: 'Week Warrior',       desc: '7-day streak achieved',             unlocked: bestStreak >= 7                  },
    { id: 'streak_30',      emoji: '🏆', title: '30-Day Champion',   desc: 'Legendary 30-day streak',           unlocked: bestStreak >= 30                 },
    { id: 'habits_5',       emoji: '🎯', title: 'Habit Builder',     desc: 'Tracking 5 or more habits',         unlocked: habits.length >= 5               },
    { id: 'complete_10',    emoji: '✅', title: '10 Completions',    desc: '10 total habit completions',        unlocked: totalCompleted >= 10             },
    { id: 'complete_100',   emoji: '💯', title: '100 Completions',   desc: '100 total habit completions',       unlocked: totalCompleted >= 100            },
    { id: 'all_today',      emoji: '🌟', title: 'Perfect Day',       desc: 'Completed ALL habits today',        unlocked: habits.length > 0 && completedToday.length === habits.length },
  ];

  res.status(200).json({
    success: true,
    achievements: {
      milestones,
      completedToday: completedToday.map((h) => ({ id: h._id, name: h.name, emoji: h.emoji, streak: h.streak })),
      totalCompleted,
      bestStreak,
    },
  });
});
