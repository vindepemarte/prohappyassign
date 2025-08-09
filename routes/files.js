import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Upload files for a project
router.post('/upload/:projectId', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { purpose = 'general' } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Create file records in database
    const fileRecords = files.map(file => [
      parseInt(projectId),
      req.userId,
      file.originalname, // file_name
      file.filename, // file_path (stored filename)
      purpose
    ]);

    const placeholders = fileRecords.map((_, index) => {
      const start = index * 5 + 1;
      return `($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4})`;
    }).join(', ');

    const values = fileRecords.flat();

    const result = await pool.query(
      `INSERT INTO project_files (
        project_id, uploader_id, file_name, file_path, purpose
      ) VALUES ${placeholders} RETURNING *`,
      values
    );

    res.status(201).json({ 
      message: 'Files uploaded successfully',
      data: result.rows 
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Get files for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await pool.query(
      'SELECT * FROM project_files WHERE project_id = $1 ORDER BY uploaded_at DESC',
      [projectId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get project files error:', error);
    res.status(500).json({ error: 'Failed to fetch project files' });
  }
});

// Download a file
router.get('/download/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info from database
    const result = await pool.query(
      'SELECT * FROM project_files WHERE id = $1',
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileRecord = result.rows[0];
    const filePath = path.join(process.cwd(), 'uploads', fileRecord.file_path);

    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.file_name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Get file URL (for display purposes)
router.get('/url/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info from database
    const result = await pool.query(
      'SELECT * FROM project_files WHERE id = $1',
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileRecord = result.rows[0];
    
    // Return a URL that can be used to download the file
    const fileUrl = `/api/files/download/${fileId}`;

    res.json({ 
      data: {
        url: fileUrl,
        filename: fileRecord.file_name,
        path: fileRecord.file_path,
        purpose: fileRecord.purpose
      }
    });
  } catch (error) {
    console.error('Get file URL error:', error);
    res.status(500).json({ error: 'Failed to get file URL' });
  }
});

// Delete a file
router.delete('/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info first
    const fileResult = await pool.query(
      'SELECT * FROM project_files WHERE id = $1',
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileRecord = fileResult.rows[0];

    // Delete from database
    await pool.query('DELETE FROM project_files WHERE id = $1', [fileId]);

    // Delete from disk
    const filePath = path.join(process.cwd(), 'uploads', fileRecord.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;