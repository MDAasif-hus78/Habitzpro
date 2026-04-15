const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `avatar_${req.user.id}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase())
           && allowed.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed.'));
};

const maxSizeMB = parseInt(process.env.MAX_AVATAR_SIZE_MB || '2');

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
});

module.exports = upload;
