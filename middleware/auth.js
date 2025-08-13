import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Verify session token with database check
const verifySession = async (token) => {
  try {
    // First verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
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

    const user = sessionResult.rows[0];
    return {
      ...decoded,
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      hierarchy: {
        level: user.hierarchy_level,
        parent_id: user.parent_id,
        super_agent_id: user.super_agent_id
      }
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
};

// Enhanced middleware to verify JWT token with session validation
export const authenticateToken = (req, res, next) => {
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

      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  })();
};

export default { authenticateToken };