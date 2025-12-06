import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import os from 'os';

// Use /tmp for serverless environments (Vercel), otherwise use ./uploads
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const uploadBaseDir = isServerless ? path.join(os.tmpdir(), 'uploads') : './uploads';

// Ensure upload directories exist
const uploadDirs = [
  path.join(uploadBaseDir, 'csv'),
  path.join(uploadBaseDir, 'recordings')
];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage for CSV files
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadBaseDir, 'csv'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  },
});

// File filter for CSV
const csvFileFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'));
  }
};

// Multer upload instance for CSV
export const uploadCSV = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
}).single('file');

// Error handling middleware for multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File is too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};