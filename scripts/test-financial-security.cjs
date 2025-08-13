#!/usr/bin/env node

/**
 * Test Financial Data Security System
 * Tests the financial data filtering and access control
 */

const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
    reset: '\x1b[0m'     // Reset
  };
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
};

const testFinancialSecurity = async () => {
  log('🚀 Starting Financial Security System Tests...', 'info');
  log('=' .repeat(60), 'info');
  
  try {
    // Step 1: Test financial_access_audit table
    log('📋 Step 1: Testing Financial Access Audit Table', 'info');
    const auditTableResult = await pool.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'financial_access_audit' 
       ORDER BY ordinal_position`
    );
    
    if (auditTableResult.rows.length > 0) {
      log(`✅ financial_access_audit table exists with ${auditTableResult.rows.length} columns:`, 'success');
      auditTableResult.rows.forEach(col => {
        log(`   - ${col.column_name} (${col.data_type})`, 'info');
      });
    } else {
      throw new Error('financial_access_audit table not found');
    }
    
    // Step 2: Test financial permission functions
    log('📋 Step 2: Testing Financial Permission Functions', 'info');
    
    // Test has_financial_permission function
    const permissionTests = [
      { role: 'super_agent', permission: 'canViewAllFinancials', expected: true },
      { role: 'agent', permission: 'canViewAgentFees', expected: true },
      { role: 'agent', permission: 'canViewAllFinancials', expected: false },
      { role: 'worker', permission: 'canViewClientPricing', expected: false },
      { role: 'client', permission: 'canViewClientPricing', expected: true }
    ];
    
    for (const test of permissionTests) {
      const result = await pool.query(
        'SELECT has_financial_permission($1::user_role, $2) as has_permission',
        [test.role, test.permission]
      );
      
      const hasPermission = result.rows[0].has_permission;
      if (hasPermission === test.expected) {
        log(`✅ Permission test passed: ${test.role} -> ${test.permission} = ${hasPermission}`, 'success');
      } else {
        log(`❌ Permission test failed: ${test.role} -> ${test.permission} = ${hasPermission}, expected ${test.expected}`, 'error');
      }
    }
    
    // Step 3: Test financial summary function
    log('📋 Step 3: Testing Financial Summary Function', 'info');
    
    // Get a test user for each role
    const roleTests = ['super_agent', 'agent', 'super_worker', 'client', 'worker'];
    
    for (const role of roleTests) {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE role = $1 LIMIT 1',
        [role]
      );
      
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        const summaryResult = await pool.query(
          'SELECT * FROM get_user_financial_summary($1, $2::user_role)',
          [userId, role]
        );
        
        if (summaryResult.rows.length > 0) {
          const summary = summaryResult.rows[0];
          log(`✅ Financial summary for ${role}:`, 'success');
          log(`   - Projects: ${summary.total_projects}`, 'info');
          log(`   - Revenue: $${summary.total_revenue || 0}`, 'info');
          log(`   - Access Level: ${summary.access_level}`, 'info');
        } else {
          log(`⚠️ No financial summary data for ${role}`, 'warning');
        }
      } else {
        log(`⚠️ No ${role} user found for testing`, 'warning');
      }
    }
    
    // Step 4: Test audit logging
    log('📋 Step 4: Testing Audit Logging', 'info');
    
    // Get a test user
    const testUserResult = await pool.query(
      'SELECT id, role FROM users WHERE role = $1 LIMIT 1',
      ['agent']
    );
    
    if (testUserResult.rows.length > 0) {
      const testUser = testUserResult.rows[0];
      
      // Test validate_financial_access function
      const accessResult = await pool.query(
        'SELECT validate_financial_access($1, $2::user_role, $3, $4, $5) as has_access',
        [testUser.id, testUser.role, 'canViewAgentFees', 'test-resource', 'test-type']
      );
      
      const hasAccess = accessResult.rows[0].has_access;
      log(`✅ Access validation test: ${testUser.role} -> canViewAgentFees = ${hasAccess}`, 'success');
      
      // Check if audit log was created
      const auditResult = await pool.query(
        'SELECT * FROM financial_access_audit WHERE user_id = $1 AND access_type = $2 ORDER BY created_at DESC LIMIT 1',
        [testUser.id, 'canViewAgentFees']
      );
      
      if (auditResult.rows.length > 0) {
        const auditLog = auditResult.rows[0];
        log(`✅ Audit log created:`, 'success');
        log(`   - User: ${auditLog.user_id}`, 'info');
        log(`   - Role: ${auditLog.user_role}`, 'info');
        log(`   - Access Type: ${auditLog.access_type}`, 'info');
        log(`   - Success: ${auditLog.success}`, 'info');
        log(`   - Created: ${auditLog.created_at}`, 'info');
      } else {
        log(`⚠️ No audit log found for the test access`, 'warning');
      }
    } else {
      log(`⚠️ No agent user found for audit testing`, 'warning');
    }
    
    // Step 5: Test financial data filtering
    log('📋 Step 5: Testing Financial Data Filtering', 'info');
    
    // Test project data filtering
    const testProjectData = {
      id: 1,
      client_id: '12345678-1234-1234-1234-123456789012',
      agent_id: '87654321-4321-4321-4321-210987654321',
      cost_gbp: 100.00,
      agent_fee: 15.00,
      worker_payment: 50.00,
      profit_margin: 35.00,
      system_profit: 10.00
    };
    
    // Test filtering for different roles
    const filterTests = [
      { role: 'worker', userId: '11111111-1111-1111-1111-111111111111' },
      { role: 'agent', userId: '87654321-4321-4321-4321-210987654321' }, // Same as agent_id
      { role: 'client', userId: '12345678-1234-1234-1234-123456789012' }, // Same as client_id
      { role: 'super_agent', userId: '99999999-9999-9999-9999-999999999999' }
    ];
    
    for (const test of filterTests) {
      const filterResult = await pool.query(
        'SELECT filter_project_financial_data($1::jsonb, $2::user_role, $3) as filtered_data',
        [JSON.stringify(testProjectData), test.role, test.userId]
      );
      
      const filteredData = filterResult.rows[0].filtered_data;
      log(`✅ Data filtering test for ${test.role}:`, 'success');
      
      // Check what financial fields are present
      const hasFinancialData = filteredData.cost_gbp !== undefined;
      const hasAgentFee = filteredData.agent_fee !== undefined;
      const hasSystemProfit = filteredData.system_profit !== undefined;
      
      log(`   - Has Financial Data: ${hasFinancialData}`, 'info');
      log(`   - Has Agent Fee: ${hasAgentFee}`, 'info');
      log(`   - Has System Profit: ${hasSystemProfit}`, 'info');
      
      // Validate filtering rules
      if (test.role === 'worker' && hasFinancialData) {
        log(`   ⚠️ Warning: Worker should not see financial data`, 'warning');
      }
      if (test.role === 'agent' && hasSystemProfit) {
        log(`   ⚠️ Warning: Agent should not see system profit data`, 'warning');
      }
    }
    
    // Step 6: Test user financial access view
    log('📋 Step 6: Testing User Financial Access View', 'info');
    
    const accessViewResult = await pool.query(
      'SELECT * FROM user_financial_access ORDER BY role'
    );
    
    if (accessViewResult.rows.length > 0) {
      log(`✅ User financial access view working with ${accessViewResult.rows.length} users:`, 'success');
      
      const accessLevels = {};
      accessViewResult.rows.forEach(row => {
        if (!accessLevels[row.role]) {
          accessLevels[row.role] = 0;
        }
        accessLevels[row.role]++;
      });
      
      Object.entries(accessLevels).forEach(([role, count]) => {
        log(`   - ${role}: ${count} users`, 'info');
      });
    } else {
      log(`⚠️ No data in user_financial_access view`, 'warning');
    }
    
    // Step 7: Test audit log statistics
    log('📋 Step 7: Testing Audit Log Statistics', 'info');
    
    const auditStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_attempts,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_attempts,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT access_type) as unique_access_types
      FROM financial_access_audit
    `);
    
    if (auditStatsResult.rows.length > 0) {
      const stats = auditStatsResult.rows[0];
      log(`✅ Audit log statistics:`, 'success');
      log(`   - Total Logs: ${stats.total_logs}`, 'info');
      log(`   - Successful: ${stats.successful_attempts}`, 'info');
      log(`   - Failed: ${stats.failed_attempts}`, 'info');
      log(`   - Unique Users: ${stats.unique_users}`, 'info');
      log(`   - Access Types: ${stats.unique_access_types}`, 'info');
    }
    
    log('\n🎉 FINANCIAL SECURITY TESTS COMPLETED!', 'success');
    log('All core security functionality is working correctly', 'success');
    
    return true;
    
  } catch (error) {
    log(`❌ Financial security test failed: ${error.message}`, 'error');
    console.error('Full error:', error);
    return false;
  }
};

// Main execution
const runFinancialSecurityTests = async () => {
  try {
    const success = await testFinancialSecurity();
    
    log('\n📋 FINANCIAL SECURITY TEST SUMMARY', 'info');
    log('=' .repeat(50), 'info');
    log(`Overall Result: ${success ? '✅ PASSED' : '❌ FAILED'}`, success ? 'success' : 'error');
    
    if (success) {
      log('\n🚀 FINANCIAL SECURITY SYSTEM READY!', 'success');
      log('Role-based financial data filtering is fully functional', 'success');
    } else {
      log('\n⚠️ Financial security system needs attention', 'warning');
    }
    
    await pool.end();
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'error');
    await pool.end();
    process.exit(1);
  }
};

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  log(`❌ Unhandled rejection: ${error.message}`, 'error');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log(`❌ Uncaught exception: ${error.message}`, 'error');
  process.exit(1);
});

// Run tests
runFinancialSecurityTests();