const mongoose = require('mongoose');

// ── Chart cell: one ticked day in the monthly tracking grid ─
const chartCellSchema = new mongoose.Schema(
  {
    year:  { type: Number, required: true },
    month: { type: Number, required: true, min: 0, max: 11 }, // 0-indexed
    day:   { type: Number, required: true, min: 1, max: 31 },
    ticked: { type: Boolean, default: true },
  },
  { _id: false }
);

// ── Habit schema ─────────────────────────────────────────────
const habitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
      maxlength: [100, 'Habit name cannot exceed 100 characters'],
    },
    emoji: {
      type: String,
      default: '⭐',
    },
    category: {
      type: String,
      enum: ['Health', 'Mind', 'Lifestyle', 'Work', 'Social'],
      default: 'Health',
    },
    note: {
      type: String,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: '',
    },
    // ISO date strings (YYYY-MM-DD) for daily completion tracking
    completedDates: {
      type: [String],
      default: [],
    },
    // Monthly tracking chart cells
    chartCells: {
      type: [chartCellSchema],
      default: [],
    },
    // Per-habit goal (number of days) for the tracking chart
    goal: {
      type: Number,
      default: 30,
      min: 1,
    },
    // Cached streak (recomputed on toggle for performance)
    streak: {
      type: Number,
      default: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_, ret) { delete ret.__v; return ret; } },
  }
);

// ── Compound index: user + name uniqueness ───────────────────
habitSchema.index({ user: 1, name: 1 }, { unique: true });

// ── Static: compute streak from sorted date strings ──────────
habitSchema.statics.computeStreak = function (completedDates) {
  if (!completedDates || completedDates.length === 0) return 0;
  const sorted = [...completedDates].sort();
  const today  = new Date().toISOString().split('T')[0];
  let streak = 0;
  const check = new Date(today);

  for (let i = sorted.length - 1; i >= 0; i--) {
    const ds = check.toISOString().split('T')[0];
    if (sorted[i] === ds) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else if (sorted[i] < ds) {
      break;
    }
  }
  return streak;
};

module.exports = mongoose.model('Habit', habitSchema);
