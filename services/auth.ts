import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, transaction } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const TOKEN_EXPIRY = '7d';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'client' | 'worker' | 'agent';
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResult {
  user: User;
  token: string;
  expires_at: string;
}

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

// Verify password
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

// Generate JWT token
export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
};

// Verify JWT token
export const verifyToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
};

// Create session in database
const createSession = async (userId: string, token: string, userAgent?: string, ipAddress?: string) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address) 
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent, ipAddress]
  );

  return expiresAt;
};

// Register new user
export const register = async (data: {
  email: string;
  password: string;
  full_name: string;
  role?: 'client' | 'worker' | 'agent';
}): Promise<AuthResult> => {
  const { email, password, full_name, role = 'client' } = data;

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existingUser.rows.length > 0) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user and session in transaction
  return await transaction(async (client) => {
    // Insert user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, email_verified) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, full_name, role, avatar_url, email_verified, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, full_name, role, true]
    );

    const user = userResult.rows[0];

    // Generate token and create session
    const token = generateToken(user.id);
    const expiresAt = await createSession(user.id, token);

    return {
      user,
      token,
      expires_at: expiresAt.toISOString()
    };
  });
};

// Login user
export const login = async (credentials: {
  email: string;
  password: string;
}): Promise<AuthResult> => {
  const { email, password } = credentials;

  // Get user by email
  const userResult = await query(
    'SELECT id, email, password_hash, full_name, role, avatar_url, email_verified, created_at, updated_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = userResult.rows[0];

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  // Generate token and create session
  const token = generateToken(user.id);
  const expiresAt = await createSession(user.id, token);

  // Remove password hash from user object
  const { password_hash, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    token,
    expires_at: expiresAt.toISOString()
  };
};

// Get user by ID
export const getUserById = async (userId: string): Promise<User | null> => {
  const result = await query(
    'SELECT id, email, full_name, role, avatar_url, email_verified, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
};

// Verify session token
export const verifySession = async (token: string): Promise<User | null> => {
  // Verify JWT
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  // Check if session exists in database
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const sessionResult = await query(
    `SELECT s.user_id, s.expires_at, u.id, u.email, u.full_name, u.role, u.avatar_url, u.email_verified, u.created_at, u.updated_at
     FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (sessionResult.rows.length === 0) {
    return null;
  }

  // Update last_used_at
  await query(
    'UPDATE user_sessions SET last_used_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );

  const { user_id, expires_at, ...user } = sessionResult.rows[0];
  return user;
};

export default {
  register,
  login,
  getUserById,
  verifySession,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken
};