import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

// Debug environment variables (remove in production)
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is not set!');
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
}

// Enhanced middleware to verify JWT token with session validation
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Use async function inside middleware
  (async () => {
    try {
      // Verify session with database check
      const user = await verifySession(token);
      if (!user) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      // Add user info to request
      req.userId = user.id;
      req.userRole = user.role;
      req.userHierarchy = user.hierarchy;
      req.user = user;
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(403).json({ error: 'Authentication failed' });
    }
  })();
};

// Helper functions
const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const generateToken = (userId, userRole, hierarchyInfo = null) => {
  const payload = { 
    userId, 
    role: userRole,
    iat: Math.floor(Date.now() / 1000)
  };
  
  // Include hierarchy information in token for faster access control
  if (hierarchyInfo) {
    payload.hierarchy = {
      level: hierarchyInfo.hierarchy_level,
      superAgentId: hierarchyInfo.super_agent_id,
      parentId: hierarchyInfo.parent_id
    };
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Create session in database
const createSession = async (userId, token, userAgent, ipAddress) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address) 
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, tokenHash, expiresAt, userAgent || 'Unknown', ipAddress || '127.0.0.1']
    );
    return expiresAt;
  } catch (error) {
    console.error('Error creating session:', error);
    // Don't throw error - session creation is not critical for auth
    return expiresAt;
  }
};

// Verify session token with database check
const verifySession = async (token) => {
  try {
    // First verify JWT
    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    // Check if session exists in database and is valid
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionResult = await pool.query(
      `SELECT s.user_id, s.expires_at, u.id, u.email, u.full_name, u.role, 
              u.avatar_url, u.email_verified, u.reference_code_used, u.recruited_by, 
              u.super_agent_id, u.created_at, u.updated_at,
              uh.hierarchy_level, uh.parent_id
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    // Update last_used_at
    await pool.query(
      'UPDATE user_sessions SET last_used_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );

    const row = sessionResult.rows[0];
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      avatar_url: row.avatar_url,
      email_verified: row.email_verified,
      reference_code_used: row.reference_code_used,
      recruited_by: row.recruited_by,
      super_agent_id: row.super_agent_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      hierarchy: {
        level: row.hierarchy_level,
        parent_id: row.parent_id
      }
    };
  } catch (error) {
    console.error('Error verifying session:', error);
    return null;
  }
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, reference_code } = req.body;

    if (!email || !password || !full_name || !reference_code) {
      return res.status(400).json({ 
        error: 'Email, password, full name, and reference code are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Validate reference code
    const { default: ReferenceCodeService } = await import('../services/referenceCodeService.js');
    const validation = await ReferenceCodeService.validateReferenceCode(reference_code);
    
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid or inactive reference code' 
      });
    }

    // Determine user role based on reference code type
    let userRole = 'client'; // default
    switch (validation.codeType) {
      case 'agent_recruitment':
        userRole = 'agent';
        break;
      case 'client_recruitment':
        userRole = 'client';
        break;
      case 'worker_recruitment':
        userRole = 'worker';
        break;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Start transaction for user creation and hierarchy setup
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, email_verified, 
                           reference_code_used, recruited_by, super_agent_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, email, full_name, role, avatar_url, email_verified, 
                   reference_code_used, recruited_by, super_agent_id, created_at, updated_at`,
        [
          email.toLowerCase(), 
          passwordHash, 
          full_name, 
          userRole, 
          true,
          reference_code.trim().toUpperCase(),
          validation.owner.id,
          validation.owner.super_agent_id || validation.owner.id // If owner is super_agent, use their ID
        ]
      );

      const user = userResult.rows[0];

      // Set up user hierarchy manually within the transaction
      let hierarchyLevel;
      let parentId = validation.owner.id;
      let superAgentId = validation.owner.super_agent_id || validation.owner.id;

      switch (validation.codeType) {
        case 'agent_recruitment':
          hierarchyLevel = 2; // Agent level
          break;
        case 'client_recruitment':
          hierarchyLevel = 3; // Client level
          break;
        case 'worker_recruitment':
          hierarchyLevel = 4; // Worker level
          break;
        default:
          throw new Error('Unknown reference code type');
      }

      // Insert hierarchy record
      const hierarchyResult = await client.query(
        `INSERT INTO user_hierarchy (user_id, parent_id, hierarchy_level, super_agent_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [user.id, parentId, hierarchyLevel, superAgentId]
      );

      const hierarchyInfo = hierarchyResult.rows[0];

      // Generate reference codes for new agents and super_workers
      if (['agent', 'super_worker'].includes(userRole)) {
        const codes = await ReferenceCodeService.generateCodesForUser(user.id, userRole);
        console.log(`Generated ${codes.length} reference codes for new ${userRole}`);
      }

      await client.query('COMMIT');

      // Generate token with hierarchy information
      const token = generateToken(user.id, userRole, hierarchyInfo);

      // Create session record
      await createSession(user.id, token, req.headers['user-agent'], req.ip);

      res.status(201).json({
        message: 'User registered successfully',
        user,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        hierarchy_info: hierarchyInfo
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed' 
    });
  }
});

// Test route to verify auth routing is working
router.get('/test', (req, res) => {
  console.log('🧪 Auth test route hit');
  res.json({ message: 'Auth routes are working', timestamp: new Date().toISOString() });
});

// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt for:', req.body.email);
    console.log('🔍 Request method:', req.method);
    console.log('🔍 Request headers:', req.headers);
    
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Get user by email
    const userResult = await pool.query(
      'SELECT id, email, password_hash, full_name, role, avatar_url, email_verified, created_at, updated_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get user's hierarchy information
    const hierarchyResult = await pool.query(
      `SELECT hierarchy_level, parent_id, super_agent_id
       FROM user_hierarchy WHERE user_id = $1`,
      [user.id]
    );

    const hierarchyInfo = hierarchyResult.rows[0] || null;

    // Generate token with hierarchy information
    const token = generateToken(user.id, user.role, hierarchyInfo);

    // Create session record
    await createSession(user.id, token, req.headers['user-agent'], req.ip);

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: {
        ...userWithoutPassword,
        hierarchy: hierarchyInfo
      },
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed' 
    });
  }
});

// Get current user profile with hierarchy information
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    // Verify session with database check
    const user = await verifySession(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(401).json({ 
      error: 'Invalid or expired token' 
    });
  }
});

// Logout user - invalidate session
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Remove session from database
      await pool.query(
        'DELETE FROM user_sessions WHERE token_hash = $1',
        [tokenHash]
      );
    }
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get user's active sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_agent, ip_address, created_at, last_used_at, expires_at
       FROM user_sessions 
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_used_at DESC`,
      [req.userId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Revoke a specific session
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(
      'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// Revoke all sessions except current
router.post('/sessions/revoke-all', authenticateToken, async (req, res) => {
  try {
    const currentToken = req.headers.authorization?.replace('Bearer ', '');
    let currentTokenHash = null;
    
    if (currentToken) {
      currentTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    }

    const result = await pool.query(
      'DELETE FROM user_sessions WHERE user_id = $1 AND ($2 IS NULL OR token_hash != $2)',
      [req.userId, currentTokenHash]
    );

    res.json({ 
      message: 'All other sessions revoked successfully',
      revoked_count: result.rowCount
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify current session
    const user = await verifySession(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Generate new token with updated hierarchy info
    const hierarchyResult = await pool.query(
      `SELECT hierarchy_level, parent_id, super_agent_id
       FROM user_hierarchy WHERE user_id = $1`,
      [user.id]
    );

    const hierarchyInfo = hierarchyResult.rows[0] || null;
    const newToken = generateToken(user.id, user.role, hierarchyInfo);

    // Remove old session and create new one
    const oldTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [oldTokenHash]);
    
    await createSession(user.id, newToken, req.headers['user-agent'], req.ip);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      user: {
        ...user,
        hierarchy: hierarchyInfo
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters long' 
      });
    }

    // Get current user with password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.userId]
    );

    // Revoke all other sessions for security
    const currentToken = req.headers.authorization?.replace('Bearer ', '');
    let currentTokenHash = null;
    
    if (currentToken) {
      currentTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    }

    await pool.query(
      'DELETE FROM user_sessions WHERE user_id = $1 AND ($2 IS NULL OR token_hash != $2)',
      [req.userId, currentTokenHash]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Search users endpoint (hierarchy-aware)
router.get('/users/search', authenticateToken, async (req, res) => {
  try {
    const { q: searchTerm, role } = req.query;
    
    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ data: [] });
    }

    // Get user's role and hierarchy info for access control
    const userInfo = await pool.query(
      `SELECT u.role, uh.hierarchy_level, uh.super_agent_id
       FROM users u
       LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
       WHERE u.id = $1`,
      [req.userId]
    );

    if (userInfo.rows.length === 0) {
      return res.status(403).json({ error: 'User not found' });
    }

    const user = userInfo.rows[0];
    let whereClause = '';
    let params = [`%${searchTerm}%`];

    // Apply hierarchy-based access control
    if (user.role === 'super_agent') {
      // Super agents can search their entire network
      whereClause = 'AND (uh.super_agent_id = $2 OR u.id = $2)';
      params.push(req.userId);
    } else if (['agent', 'super_worker'].includes(user.role)) {
      // Agents and super workers can search their direct subordinates
      whereClause = 'AND uh.parent_id = $2';
      params.push(req.userId);
    } else {
      // Other roles can only search themselves
      whereClause = 'AND u.id = $2';
      params.push(req.userId);
    }

    // Add role filter if specified
    if (role && ['client', 'worker', 'agent', 'super_agent', 'super_worker'].includes(role)) {
      whereClause += ` AND u.role = $${params.length + 1}`;
      params.push(role);
    }

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, uh.hierarchy_level,
              parent.full_name as parent_name
       FROM users u
       LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
       LEFT JOIN users parent ON uh.parent_id = parent.id
       WHERE (u.full_name ILIKE $1 OR u.email ILIKE $1 OR u.id::text ILIKE $1)
       ${whereClause}
       ORDER BY u.full_name
       LIMIT 10`,
      params
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Catch-all handler for unmatched auth routes
router.use('*', (req, res) => {
  console.log(`❌ Unmatched auth route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Auth endpoint not found',
    method: req.method,
    path: req.originalUrl
  });
});

export default router;