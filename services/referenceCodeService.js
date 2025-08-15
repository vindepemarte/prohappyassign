import { Pool } from 'pg';
import crypto from 'crypto';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

// Helper function to execute queries
const query = async (text, params) => {
  const res = await pool.query(text, params);
  return res;
};

// Helper function for transactions
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export class ReferenceCodeService {
  /**
   * Generate unique reference codes for a user based on their role
   */
  static async generateCodesForUser(userId, role) {
    const codes = [];
    
    try {
      return await transaction(async (client) => {
        // Determine what types of codes to generate based on role
        const codeTypes = [];
        
        switch (role) {
          case 'super_agent':
            codeTypes.push(
              { type: 'agent_recruitment', prefix: 'SA-AGT' },
              { type: 'client_recruitment', prefix: 'SA-CLI' }
            );
            break;
          case 'agent':
            codeTypes.push({ type: 'client_recruitment', prefix: 'AGT-CLI' });
            break;
          case 'super_worker':
            codeTypes.push({ type: 'worker_recruitment', prefix: 'SW-WRK' });
            break;
          default:
            // Other roles don't get reference codes
            return codes;
        }
        
        // Generate codes for each type
        for (const { type, prefix } of codeTypes) {
          const code = await this.generateUniqueCode(prefix, client);
          
          const result = await client.query(
            `INSERT INTO reference_codes (code, owner_id, code_type, is_active) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [code, userId, type, true]
          );
          
          codes.push(result.rows[0]);
        }
        
        return codes;
      });
    } catch (error) {
      console.error('Error generating reference codes:', error);
      throw new Error(`Failed to generate reference codes for user ${userId}`);
    }
  }
  
  /**
   * Generate a unique reference code with given prefix
   */
  static async generateUniqueCode(prefix, client = null) {
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      // Generate random 8-character suffix
      const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
      const code = `${prefix}-${suffix}`;
      
      // Check if code already exists
      const queryMethod = client ? client.query.bind(client) : query;
      const existsResult = await queryMethod(
        'SELECT COUNT(*) as count FROM reference_codes WHERE code = $1',
        [code]
      );
      
      if (parseInt(existsResult.rows[0].count) === 0) {
        return code;
      }
      
      attempts++;
    }
    
    throw new Error('Failed to generate unique reference code after maximum attempts');
  }
  
  /**
   * Validate a reference code and return owner information
   */
  static async validateReferenceCode(code) {
    try {
      const result = await query(
        `SELECT rc.*, u.id, u.email, u.full_name, u.role, u.avatar_url, 
                u.email_verified, u.reference_code_used, u.recruited_by, 
                u.super_agent_id, u.created_at, u.updated_at
         FROM reference_codes rc
         JOIN users u ON rc.owner_id = u.id
         WHERE rc.code = $1 AND rc.is_active = true`,
        [code.trim().toUpperCase()]
      );
      
      if (result.rows.length === 0) {
        return {
          isValid: false,
          owner: null,
          codeType: null
        };
      }
      
      const row = result.rows[0];
      const owner = {
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
        updated_at: row.updated_at
      };
      
      return {
        isValid: true,
        owner,
        codeType: row.code_type
      };
    } catch (error) {
      console.error('Error validating reference code:', error);
      throw new Error('Failed to validate reference code');
    }
  }
  
  /**
   * Get all reference codes for a user
   */
  static async getUserReferenceCodes(userId) {
    try {
      const result = await query(
        'SELECT * FROM reference_codes WHERE owner_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error fetching user reference codes:', error);
      throw new Error('Failed to fetch user reference codes');
    }
  }
  
  /**
   * Deactivate a reference code
   */
  static async deactivateReferenceCode(codeId, userId) {
    try {
      const result = await query(
        'UPDATE reference_codes SET is_active = false WHERE id = $1 AND owner_id = $2',
        [codeId, userId]
      );
      
      if (result.rowCount === 0) {
        throw new Error('Reference code not found or not owned by user');
      }
    } catch (error) {
      console.error('Error deactivating reference code:', error);
      throw new Error('Failed to deactivate reference code');
    }
  }
  
  /**
   * Get reference code usage statistics
   */
  static async getCodeUsageStats(codeId, userId) {
    try {
      const result = await query(
        `SELECT 
           rc.code,
           COUNT(u.id) as total_uses,
           COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_uses,
           MAX(u.created_at) as last_used
         FROM reference_codes rc
         LEFT JOIN users u ON u.reference_code_used = rc.code
         WHERE rc.id = $1 AND rc.owner_id = $2
         GROUP BY rc.code`,
        [codeId, userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Reference code not found or not owned by user');
      }
      
      return {
        code: result.rows[0].code,
        total_uses: parseInt(result.rows[0].total_uses),
        recent_uses: parseInt(result.rows[0].recent_uses),
        last_used: result.rows[0].last_used
      };
    } catch (error) {
      console.error('Error fetching code usage stats:', error);
      throw new Error('Failed to fetch code usage statistics');
    }
  }
}

export default ReferenceCodeService;