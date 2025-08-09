import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET;

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

// Create notification record
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      user_id,
      project_id,
      title,
      body,
      delivery_status
    } = req.body;

    const result = await pool.query(
      `INSERT INTO notification_history (
        user_id, project_id, title, body, delivery_status, retry_count, is_read
      ) VALUES ($1, $2, $3, $4, $5, 0, false)
      RETURNING *`,
      [user_id, project_id || null, title, body, delivery_status || 'pending']
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Update notification status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { delivery_status, error_message, delivered_at, is_read } = req.body;
    const notificationId = req.params.id;

    const updateData = {
      delivery_status,
      updated_at: new Date()
    };

    if (error_message) updateData.error_message = error_message;
    if (delivered_at) updateData.delivered_at = delivered_at;
    if (is_read !== undefined) updateData.is_read = is_read;

    const setClause = Object.keys(updateData).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updateData);
    values.push(notificationId);

    const result = await pool.query(
      `UPDATE notification_history SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Update notification status error:', error);
    res.status(500).json({ error: 'Failed to update notification status' });
  }
});

// Get failed notifications
router.get('/failed', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notification_history WHERE delivery_status = $1 ORDER BY created_at DESC',
      ['failed']
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get failed notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch failed notifications' });
  }
});

// Get notification history for user
router.get('/history/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const result = await pool.query(
      'SELECT * FROM notification_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get notification history error:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// Get notification analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = 'SELECT delivery_status FROM notification_history';
    const params = [];

    if (startDate && endDate) {
      query += ' WHERE created_at BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }

    const result = await pool.query(query, params);
    
    const statusCounts = result.rows.reduce((acc, row) => {
      acc[row.delivery_status] = (acc[row.delivery_status] || 0) + 1;
      return acc;
    }, {});

    const totalNotifications = result.rows.length;
    const successfulDeliveries = statusCounts.delivered || 0;
    const deliveryRate = totalNotifications > 0 ? (successfulDeliveries / totalNotifications) * 100 : 0;

    res.json({
      data: {
        totalNotifications,
        successfulDeliveries,
        deliveryRate,
        statusBreakdown: statusCounts
      }
    });
  } catch (error) {
    console.error('Get notification analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch notification analytics' });
  }
});

// Increment retry count
router.patch('/:id/retry', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const result = await pool.query(
      'UPDATE notification_history SET retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1 RETURNING *',
      [notificationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Increment retry count error:', error);
    res.status(500).json({ error: 'Failed to increment retry count' });
  }
});

// Clean up old notifications
router.delete('/cleanup', authenticateToken, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await pool.query(
      'DELETE FROM notification_history WHERE created_at < $1',
      [thirtyDaysAgo.toISOString()]
    );

    res.json({ 
      message: 'Cleanup completed',
      deletedCount: result.rowCount 
    });
  } catch (error) {
    console.error('Cleanup notifications error:', error);
    res.status(500).json({ error: 'Failed to cleanup notifications' });
  }
});

export default router;