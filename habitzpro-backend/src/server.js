require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const morgan      = require('morgan');
const path        = require('path');
const rateLimit   = require('express-rate-limit');

const connectDB       = require('./config/db');
const authRoutes      = require('./routes/authRoutes');
const userRoutes      = require('./routes/userRoutes');
const habitRoutes     = require('./routes/habitRoutes');
const { errorHandler } = require('./middleware/errorHandler');

// ── Connect to MongoDB ───────────────────────────────────────
connectDB();

const app = express();

// ── Security: rate limiting ──────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests — please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message: { success: false, message: 'Too many login attempts — please try again in 15 minutes.' },
});

app.use(globalLimiter);

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. Postman, mobile apps, same-origin file://)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed.`));
  },
  credentials: true,
}));

// ── Body parsers ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logger ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// ── Static: serve uploaded avatars ───────────────────────────
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadDir));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.status(200).json({
    success: true,
    message: 'HabitzPro API is running 🚀',
    env:     process.env.NODE_ENV,
    time:    new Date().toISOString(),
  });
});

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',   authLimiter, authRoutes);
app.use('/api/users',  userRoutes);
app.use('/api/habits', habitRoutes);

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Global error handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n🚀  HabitzPro API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  console.log(`📖  Health check: http://localhost:${PORT}/api/health\n`);
});

// Graceful shutdown
process.on('unhandledRejection', (err) => {
  console.error('❌  Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('⚠️   SIGTERM received — shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = app;
