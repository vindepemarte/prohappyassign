import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
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

// Send hierarchy-aware notification
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { targetUsers, title, body, notificationType = 'general', projectId } = req.body;
    
    if (!targetUsers || !Array.isArray(targetUsers) || targetUsers.length === 0) {
      return res.status(400).json({ error: 'Target users array is required' });
    }
    
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    
    // Use the hierarchy notification function
    const result = await pool.query(
      'SELECT * FROM send_hierarchy_notification($1, $2, $3, $4, $5, $6)',
      [req.userId, targetUsers, title, body, notificationType, projectId]
    );
    
    const results = result.rows;
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    res.json({
      success: true,
      message: `Sent ${successful} notifications, ${failed} failed`,
      data: {
        total: results.length,
        successful,
        failed,
        results
      }
    });
  } catch (error) {
    console.error('Error sending hierarchy notification:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Broadcast notification to all subordinates
router.post('/broadcast', authenticateToken, async (req, res) => {
  try {
    const { title, body, notificationType = 'broadcast', includeClients = true } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    
    // Get all subordinates
    const subordinatesResult = await pool.query(
      'SELECT subordinate_id FROM get_user_subordinates($1)',
      [req.userId]
    );
    
    let targetUsers = subordinatesResult.rows.map(row => row.subordinate_id);
    
    // Filter out clients if not included
    if (!includeClients) {
      const nonClientUsers = await pool.query(
        'SELECT id FROM users WHERE id = ANY($1) AND role != $2',
        [targetUsers, 'client']
      );
      targetUsers = nonClientUsers.rows.map(row => row.id);
    }
    
    if (targetUsers.length === 0) {
      return res.json({
        success: true,
        message: 'No subordinates found to broadcast to',
        data: { total: 0, successful: 0, failed: 0 }
      });
    }
    
    // Send to all subordinates
    const result = await pool.query(
      'SELECT * FROM send_hierarchy_notification($1, $2, $3, $4, $5, $6)',
      [req.userId, targetUsers, title, body, notificationType, null]
    );
    
    const results = result.rows;
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    res.json({
      success: true,
      message: `Broadcast sent to ${successful} users, ${failed} failed`,
      data: {
        total: results.length,
        successful,
        failed,
        results
      }
    });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

// Create notification record (legacy endpoint)
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
        user_id, project_id, title, body, delivery_status, retry_count, is_read, sender_id
      ) VALUES ($1, $2, $3, $4, $5, 0, false, $6)
      RETURNING *`,
      [user_id, project_id || null, title, body, delivery_status || 'pending', req.userId]
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

// Get notification history for user with hierarchy context
router.get('/history/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const includeRead = req.query.includeRead === 'true';

    let query = `
      SELECT 
        nh.*,
        sender.full_name as sender_name,
        sender.role as sender_role,
        p.project_name
      FROM notification_history nh
      LEFT JOIN users sender ON nh.sender_id = sender.id
      LEFT JOIN projects p ON nh.project_id = p.id
      WHERE nh.user_id = $1
    `;
    
    const params = [userId];
    
    if (!includeRead) {
      query += ' AND nh.is_read = false';
    }
    
    query += ' ORDER BY nh.created_at DESC LIMIT $2';
    params.push(limit);

    const result = await pool.query(query, params);

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

// Send Super Agent broadcast notification
router.post('/broadcast', authenticateToken, async (req, res) => {
  try {
    const { title, message } = req.body;
    const senderId = req.userId;

    // Verify sender is Super Agent
    const senderResult = await pool.query('SELECT role FROM users WHERE id = $1', [senderId]);
    if (senderResult.rows.length === 0 || senderResult.rows[0].role !== 'super_agent') {
      return res.status(403).json({ error: 'Only Super Agents can send broadcast notifications' });
    }

    // Get all users
    const usersResult = await pool.query('SELECT id FROM users WHERE id != $1', [senderId]);
    const targetUserIds = usersResult.rows.map(row => row.id);

    // Send notification to all users
    const results = [];
    for (const targetUserId of targetUserIds) {
      try {
        const result = await pool.query(
          `INSERT INTO notification_history (
            user_id, sender_id, title, body, notification_type, 
            hierarchy_level, target_roles, delivery_status
          ) VALUES ($1, $2, $3, $4, 'broadcast', 1, ARRAY['all'], 'delivered')
          RETURNING *`,
          [targetUserId, senderId, title, message]
        );
        results.push({ userId: targetUserId, success: true, data: result.rows[0] });
      } catch (error) {
        results.push({ userId: targetUserId, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      message: `Broadcast sent to ${successCount} users${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      data: { successCount, failureCount, results }
    });
  } catch (error) {
    console.error('Send broadcast notification error:', error);
    res.status(500).json({ error: 'Failed to send broadcast notification' });
  }
});

// Send Super Worker notification to subordinates
router.post('/super-worker-notify', authenticateToken, async (req, res) => {
  try {
    const { title, message, targetUserIds, projectId } = req.body;
    const senderId = req.userId;

    // Verify sender is Super Worker
    const senderResult = await pool.query('SELECT role FROM users WHERE id = $1', [senderId]);
    if (senderResult.rows.length === 0 || senderResult.rows[0].role !== 'super_worker') {
      return res.status(403).json({ error: 'Only Super Workers can send subordinate notifications' });
    }

    // Verify all target users are subordinates
    const subordinatesResult = await pool.query(
      'SELECT subordinate_id FROM get_user_subordinates($1)',
      [senderId]
    );
    const validSubordinateIds = subordinatesResult.rows.map(row => row.subordinate_id);

    const results = [];
    for (const targetUserId of targetUserIds) {
      if (!validSubordinateIds.includes(targetUserId)) {
        results.push({ userId: targetUserId, success: false, error: 'Not a subordinate' });
        continue;
      }

      try {
        const result = await pool.query(
          `INSERT INTO notification_history (
            user_id, sender_id, title, body, notification_type, 
            project_id, hierarchy_level, target_roles, delivery_status
          ) VALUES ($1, $2, $3, $4, 'hierarchy_notification', $5, 2, ARRAY['worker'], 'delivered')
          RETURNING *`,
          [targetUserId, senderId, title, message, projectId || null]
        );
        results.push({ userId: targetUserId, success: true, data: result.rows[0] });
      } catch (error) {
        results.push({ userId: targetUserId, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      message: `Notification sent to ${successCount} subordinates${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      data: { successCount, failureCount, results }
    });
  } catch (error) {
    console.error('Send Super Worker notification error:', error);
    res.status(500).json({ error: 'Failed to send Super Worker notification' });
  }
});

// Send project assignment notification
router.post('/project-assignment', authenticateToken, async (req, res) => {
  try {
    const { assigneeId, projectId, projectName } = req.body;
    const senderId = req.userId;

    // Verify sender can assign to this user (hierarchy check)
    const canSendResult = await pool.query(
      'SELECT can_send_notification($1, $2) as can_send',
      [senderId, assigneeId]
    );

    if (!canSendResult.rows[0].can_send) {
      return res.status(403).json({ error: 'Cannot send notification to this user' });
    }

    const result = await pool.query(
      `INSERT INTO notification_history (
        user_id, sender_id, title, body, notification_type, 
        project_id, delivery_status
      ) VALUES ($1, $2, $3, $4, 'project_assignment', $5, 'delivered')
      RETURNING *`,
      [
        assigneeId, 
        senderId, 
        'New Project Assignment',
        `You have been assigned to project: ${projectName}. Please review the details and begin work.`,
        projectId
      ]
    );

    res.json({ 
      message: 'Project assignment notification sent',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Send project assignment notification error:', error);
    res.status(500).json({ error: 'Failed to send project assignment notification' });
  }
});

// Get user's subordinates for notification targeting
router.get('/subordinates', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT 
        s.subordinate_id as id,
        u.full_name,
        u.email,
        s.subordinate_role as role,
        s.hierarchy_level
      FROM get_user_subordinates($1) s
      JOIN users u ON s.subordinate_id = u.id
      ORDER BY s.hierarchy_level, u.full_name`,
      [userId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get subordinates error:', error);
    res.status(500).json({ error: 'Failed to fetch subordinates' });
  }
});

// Get notification preferences
router.get('/preferences/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user can access these preferences
    if (req.userId !== userId) {
      // Check if requester is a superior in hierarchy
      const canAccessResult = await pool.query(
        'SELECT can_send_notification($1, $2) as can_access',
        [req.userId, userId]
      );

      if (!canAccessResult.rows[0].can_access) {
        return res.status(403).json({ error: 'Cannot access notification preferences for this user' });
      }
    }

    const result = await pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY notification_type',
      [userId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Update notification preferences
router.patch('/preferences/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { notificationType, enabled, deliveryMethod } = req.body;

    // Verify user can update these preferences (only own preferences)
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'Can only update your own notification preferences' });
    }

    const result = await pool.query(
      `INSERT INTO notification_preferences (user_id, notification_type, enabled, delivery_method)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, notification_type, delivery_method)
       DO UPDATE SET enabled = $3, updated_at = NOW()
       RETURNING *`,
      [userId, notificationType, enabled, deliveryMethod || 'database']
    );

    res.json({ 
      message: 'Notification preferences updated',
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
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

// Get user's notifications with hierarchy context
router.get('/my-notifications', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;
    
    let whereClause = 'WHERE nh.user_id = $1';
    let params = [req.userId];
    let paramIndex = 2;
    
    if (unreadOnly === 'true') {
      whereClause += ` AND nh.is_read = false`;
    }
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(`
      SELECT 
        nh.*,
        sender.full_name as sender_name,
        sender.role as sender_role,
        p.title as project_title,
        p.order_reference as project_reference
      FROM notification_history nh
      LEFT JOIN users sender ON nh.sender_id = sender.id
      LEFT JOIN projects p ON nh.project_id = p.id
      ${whereClause}
      ORDER BY nh.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);
    
    // Get unread count
    const unreadResult = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notification_history WHERE user_id = $1 AND is_read = false',
      [req.userId]
    );
    
    res.json({
      success: true,
      data: result.rows,
      unread_count: parseInt(unreadResult.rows[0].unread_count),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notifications as read
router.put('/mark-read', authenticateToken, async (req, res) => {
  try {
    const { notificationIds, markAll = false } = req.body;
    
    if (markAll) {
      await pool.query(
        'UPDATE notification_history SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
        [req.userId]
      );
      
      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } else if (notificationIds && Array.isArray(notificationIds)) {
      await pool.query(
        'UPDATE notification_history SET is_read = true, read_at = NOW() WHERE id = ANY($1) AND user_id = $2',
        [notificationIds, req.userId]
      );
      
      res.json({
        success: true,
        message: `${notificationIds.length} notifications marked as read`
      });
    } else {
      res.status(400).json({ error: 'Either notificationIds array or markAll=true is required' });
    }
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Get notification templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const userRole = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    const role = userRole.rows[0]?.role;
    
    const result = await pool.query(
      'SELECT * FROM notification_templates WHERE $1 = ANY(target_roles) ORDER BY template_name',
      [role]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting notification templates:', error);
    res.status(500).json({ error: 'Failed to get notification templates' });
  }
});

// Send templated notification
router.post('/send-template', authenticateToken, async (req, res) => {
  try {
    const { templateName, targetUsers, variables, projectId } = req.body;
    
    if (!templateName || !targetUsers || !Array.isArray(targetUsers)) {
      return res.status(400).json({ error: 'Template name and target users are required' });
    }
    
    // Get template
    const templateResult = await pool.query(
      'SELECT * FROM notification_templates WHERE template_name = $1',
      [templateName]
    );
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification template not found' });
    }
    
    const template = templateResult.rows[0];
    
    // Replace variables in template
    let title = template.title_template;
    let body = template.body_template;
    
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, 'g'), value);
        body = body.replace(new RegExp(placeholder, 'g'), value);
      });
    }
    
    // Send notifications
    const result = await pool.query(
      'SELECT * FROM send_hierarchy_notification($1, $2, $3, $4, $5, $6)',
      [req.userId, targetUsers, title, body, template.notification_type, projectId]
    );
    
    const results = result.rows;
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    res.json({
      success: true,
      message: `Sent ${successful} templated notifications, ${failed} failed`,
      data: {
        template_used: templateName,
        total: results.length,
        successful,
        failed,
        results
      }
    });
  } catch (error) {
    console.error('Error sending templated notification:', error);
    res.status(500).json({ error: 'Failed to send templated notification' });
  }
});

// Get notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY notification_type',
      [req.userId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// Update notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Preferences array is required' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const pref of preferences) {
        const { notification_type, enabled, delivery_method = 'database' } = pref;
        
        await client.query(`
          INSERT INTO notification_preferences (user_id, notification_type, enabled, delivery_method)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, notification_type, delivery_method)
          DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
        `, [req.userId, notification_type, enabled, delivery_method]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Get notification statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_notifications,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as notifications_24h,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as notifications_7d,
        COUNT(CASE WHEN notification_type = 'broadcast' THEN 1 END) as broadcast_notifications,
        COUNT(CASE WHEN notification_type = 'project_assignment' THEN 1 END) as assignment_notifications
      FROM notification_history
      WHERE user_id = $1
    `, [req.userId]);
    
    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (error) {
    console.error('Error getting notification statistics:', error);
    res.status(500).json({ error: 'Failed to get notification statistics' });
  }
});

export default router;