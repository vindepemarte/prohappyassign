import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { requirePermission, requireRole } from '../middleware/permissions.js';
import { PERMISSIONS } from '../services/permissionService.js';
import { 
    AppError, 
    ERROR_TYPES, 
    ERROR_MESSAGES, 
    handleApiError, 
    validateHierarchyOperation 
} from '../utils/errorHandling.js';
// ReferenceCodeService will be imported dynamically to avoid circular dependencies

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
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Get current user's role
const getUserRole = async (userId) => {
  const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.role || null;
};

// Validate reference code (public endpoint for registration)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;

    // Validate input
    const validationErrors = validateHierarchyOperation('validate_reference_code', { code });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors[0].message,
        code: validationErrors[0].code,
        isValid: false
      });
    }

    // Additional format validation
    if (!/^[A-Z]{2}-[A-Z]{3}-[A-Z0-9]{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.REFERENCE_CODE_INVALID,
        code: 'REFERENCE_CODE_INVALID_FORMAT',
        isValid: false,
        details: 'Reference code must be in format: XX-XXX-XXXXXX'
      });
    }

    const { default: ReferenceCodeService } = await import('../services/referenceCodeService.js');
    const validation = await ReferenceCodeService.validateReferenceCode(code);

    if (!validation.isValid) {
      let errorMessage = ERROR_MESSAGES.REFERENCE_CODE_INVALID;
      let errorCode = 'REFERENCE_CODE_INVALID';
      
      // Provide specific error messages based on validation result
      if (validation.reason === 'expired') {
        errorMessage = ERROR_MESSAGES.REFERENCE_CODE_EXPIRED;
        errorCode = 'REFERENCE_CODE_EXPIRED';
      } else if (validation.reason === 'not_found') {
        errorMessage = ERROR_MESSAGES.REFERENCE_CODE_NOT_FOUND;
        errorCode = 'REFERENCE_CODE_NOT_FOUND';
      } else if (validation.reason === 'inactive') {
        errorMessage = 'This reference code has been deactivated.';
        errorCode = 'REFERENCE_CODE_INACTIVE';
      }
      
      return res.status(400).json({ 
        success: false,
        error: errorMessage,
        code: errorCode,
        isValid: false,
        details: validation.reason
      });
    }

    // Return validation result without sensitive user data
    res.json({
      success: true,
      isValid: true,
      codeType: validation.codeType,
      ownerName: validation.owner?.full_name || 'Unknown',
      ownerRole: validation.owner?.role || 'Unknown',
      message: 'Reference code is valid and active.'
    });

  } catch (error) {
    console.error('Reference code validation error:', error);
    
    if (error.code === '42P01') { // Table doesn't exist
      return res.status(500).json({
        success: false,
        error: 'Database schema not properly initialized.',
        code: 'DATABASE_SCHEMA_ERROR',
        isValid: false
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: ERROR_MESSAGES.DATABASE_CONNECTION_ERROR,
      code: 'DATABASE_ERROR',
      isValid: false
    });
  }
});

// Get user's reference codes
router.get('/my-codes', authenticateToken, requirePermission(PERMISSIONS.VIEW_REFERENCE_CODES), async (req, res) => {
  try {

    const { default: ReferenceCodeService } = await import('../services/referenceCodeService.js');
    const codes = await ReferenceCodeService.getUserReferenceCodes(req.userId);
    
    // Get usage statistics for each code
    const codesWithStats = await Promise.all(
      codes.map(async (code) => {
        try {
          const stats = await ReferenceCodeService.getCodeUsageStats(code.id, req.userId);
          return { ...code, ...stats };
        } catch (error) {
          // If stats fail, return code without stats
          return { ...code, total_uses: 0, recent_uses: 0, last_used: null };
        }
      })
    );

    res.json({ data: codesWithStats });

  } catch (error) {
    console.error('Get reference codes error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch reference codes' 
    });
  }
});

// Generate new reference codes for user (typically called during registration)
router.post('/generate', authenticateToken, requirePermission(PERMISSIONS.GENERATE_REFERENCE_CODES), async (req, res) => {
  try {

    const { default: ReferenceCodeService } = await import('../services/referenceCodeService.js');
    
    // Check if user already has codes
    const existingCodes = await ReferenceCodeService.getUserReferenceCodes(req.userId);
    if (existingCodes.length > 0) {
      return res.status(400).json({ 
        error: 'User already has reference codes. Use regenerate endpoint to create new ones.' 
      });
    }

    const codes = await ReferenceCodeService.generateCodesForUser(req.userId, userRole);

    res.status(201).json({
      message: 'Reference codes generated successfully',
      data: codes
    });

  } catch (error) {
    console.error('Generate reference codes error:', error);
    res.status(500).json({ 
      error: 'Failed to generate reference codes' 
    });
  }
});

// Deactivate a reference code
router.patch('/:codeId/deactivate', authenticateToken, async (req, res) => {
  try {
    const { codeId } = req.params;

    if (!codeId || isNaN(parseInt(codeId))) {
      return res.status(400).json({ error: 'Valid code ID is required' });
    }

    const { default: ReferenceCodeService } = await import('../services/referenceCodeService.js');
    await ReferenceCodeService.deactivateReferenceCode(parseInt(codeId), req.userId);

    res.json({ message: 'Reference code deactivated successfully' });

  } catch (error) {
    console.error('Deactivate reference code error:', error);
    
    if (error.code === 'CODE_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to deactivate reference code' 
    });
  }
});

// Reactivate a reference code
router.patch('/:codeId/reactivate', authenticateToken, async (req, res) => {
  try {
    const { codeId } = req.params;

    if (!codeId || isNaN(parseInt(codeId))) {
      return res.status(400).json({ error: 'Valid code ID is required' });
    }

    const { default: ReferenceCodeService } = await import('../services/referenceCodeService.js');
    await ReferenceCodeService.reactivateReferenceCode(parseInt(codeId), req.userId);

    res.json({ message: 'Reference code reactivated successfully' });

  } catch (error) {
    console.error('Reactivate reference code error:', error);
    
    if (error.code === 'CODE_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to reactivate reference code' 
    });
  }
});

// Regenerate a reference code (creates new code and deactivates old one)
router.post('/:codeId/regenerate', authenticateToken, async (req, res) => {
  try {
    const { codeId } = req.params;

    if (!codeId || isNaN(parseInt(codeId))) {
      return res.status(400).json({ error: 'Valid code ID is required' });
    }

    const { default: ReferenceCodeService } = await import('../services/referenceCodeService.js');
    const newCode = await ReferenceCodeService.regenerateReferenceCode(parseInt(codeId), req.userId);

    res.json({
      message: 'Reference code regenerated successfully',
      data: newCode
    });

  } catch (error) {
    console.error('Regenerate reference code error:', error);
    
    if (error.code === 'CODE_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to regenerate reference code' 
    });
  }
});

// Get usage statistics for a specific code
router.get('/:codeId/stats', authenticateToken, async (req, res) => {
  try {
    const { codeId } = req.params;

    if (!codeId || isNaN(parseInt(codeId))) {
      return res.status(400).json({ error: 'Valid code ID is required' });
    }

    const { default: ReferenceCodeService } = await import('../services/referenceCodeService.js');
    const stats = await ReferenceCodeService.getCodeUsageStats(parseInt(codeId), req.userId);

    res.json({ data: stats });

  } catch (error) {
    console.error('Get code stats error:', error);
    
    if (error.code === 'CODE_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch code statistics' 
    });
  }
});

// Get users recruited by a specific reference code
router.get('/:codeId/recruited-users', authenticateToken, async (req, res) => {
  try {
    const { codeId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!codeId || isNaN(parseInt(codeId))) {
      return res.status(400).json({ error: 'Valid code ID is required' });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // First verify the code belongs to the requesting user
    const codeResult = await pool.query(
      'SELECT code FROM reference_codes WHERE id = $1 AND owner_id = $2',
      [parseInt(codeId), req.userId]
    );

    if (codeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reference code not found' });
    }

    const code = codeResult.rows[0].code;

    // Get users recruited with this code
    const usersResult = await pool.query(
      `SELECT id, full_name, email, role, created_at
       FROM users 
       WHERE reference_code_used = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [code, parseInt(limit), offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE reference_code_used = $1',
      [code]
    );

    const total = parseInt(countResult.rows[0].total);

    res.json({
      data: usersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get recruited users error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recruited users' 
    });
  }
});

export default router;