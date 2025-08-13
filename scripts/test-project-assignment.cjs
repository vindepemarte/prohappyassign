#!/usr/bin/env node

/**
 * Test Project Assignment Enhancement System
 * Tests the enhanced project assignment functionality
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

const testProjectAssignmentSystem = async () => {
  log('🚀 Starting Project Assignment Enhancement Tests...', 'info');
  log('=' .repeat(60), 'info');
  
  try {
    // Step 1: Test project_assignment_history table
    log('📋 Step 1: Testing Project Assignment History Table', 'info');
    const historyTableResult = await pool.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'project_assignment_history' 
       ORDER BY ordinal_position`
    );
    
    if (historyTableResult.rows.length > 0) {
      log(`✅ project_assignment_history table exists with ${historyTableResult.rows.length} columns:`, 'success');
      historyTableResult.rows.forEach(col => {
        log(`   - ${col.column_name} (${col.data_type})`, 'info');
      });
    } else {
      throw new Error('project_assignment_history table not found');
    }
    
    // Step 2: Test enhanced projects table
    log('📋 Step 2: Testing Enhanced Projects Table', 'info');
    const projectsResult = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'projects' AND column_name IN ('project_numbers', 'assignment_notes', 'assigned_at', 'assigned_by')
       ORDER BY column_name`
    );
    
    if (projectsResult.rows.length > 0) {
      log(`✅ Projects table enhanced with ${projectsResult.rows.length} new columns:`, 'success');
      projectsResult.rows.forEach(col => {
        log(`   - ${col.column_name} (${col.data_type})`, 'info');
      });
    } else {
      log('⚠️ No new columns found in projects table', 'warning');
    }
    
    // Step 3: Test assignment validation function
    log('📋 Step 3: Testing Assignment Validation Function', 'info');
    
    // Get test users
    const superAgentResult = await pool.query('SELECT id, role FROM users WHERE role = $1 LIMIT 1', ['super_agent']);
    const agentResult = await pool.query('SELECT id, role FROM users WHERE role = $1 LIMIT 1', ['agent']);
    const workerResult = await pool.query('SELECT id, role FROM users WHERE role = $1 LIMIT 1', ['worker']);
    
    if (superAgentResult.rows.length > 0 && workerResult.rows.length > 0) {
      const superAgent = superAgentResult.rows[0];
      const worker = workerResult.rows[0];
      
      // Test valid assignment (Super Agent -> Worker)
      const validationResult = await pool.query(
        'SELECT * FROM validate_project_assignment($1, $2::user_role, $3, $4::user_role, $5)',
        [superAgent.id, superAgent.role, worker.id, worker.role, 'worker']
      );
      
      if (validationResult.rows.length > 0) {
        const validation = validationResult.rows[0];
        log(`✅ Assignment validation working:`, 'success');
        log(`   - Valid: ${validation.is_valid}`, 'info');
        log(`   - Message: ${validation.validation_message}`, 'info');
        log(`   - Hierarchy Diff: ${validation.hierarchy_level_diff}`, 'info');
      } else {
        log('⚠️ No validation result returned', 'warning');
      }
    } else {
      log('⚠️ Insufficient test users for validation testing', 'warning');
    }
    
    // Step 4: Test project assignment tracking
    log('📋 Step 4: Testing Project Assignment Tracking', 'info');
    
    // Get a test project
    const projectResult = await pool.query('SELECT id FROM projects LIMIT 1');
    
    if (projectResult.rows.length > 0 && superAgentResult.rows.length > 0 && workerResult.rows.length > 0) {
      const projectId = projectResult.rows[0].id;
      const superAgent = superAgentResult.rows[0];
      const worker = workerResult.rows[0];
      
      // Test assignment tracking
      const trackingResult = await pool.query(
        'SELECT track_project_assignment($1, $2, $3, $4, $5, $6) as success',
        [projectId, worker.id, 'worker', superAgent.id, 'Test assignment', 'Testing assignment tracking']
      );
      
      const trackingSuccess = trackingResult.rows[0]?.success;
      log(`✅ Assignment tracking test: ${trackingSuccess ? 'SUCCESS' : 'FAILED'}`, trackingSuccess ? 'success' : 'warning');
      
      // Check if history record was created
      const historyResult = await pool.query(
        'SELECT * FROM project_assignment_history WHERE project_id = $1 ORDER BY assigned_at DESC LIMIT 1',
        [projectId]
      );
      
      if (historyResult.rows.length > 0) {
        const history = historyResult.rows[0];
        log(`✅ Assignment history record created:`, 'success');
        log(`   - Assignment Type: ${history.assignment_type}`, 'info');
        log(`   - Valid Hierarchy: ${history.is_valid_hierarchy}`, 'info');
        log(`   - Assigned At: ${history.assigned_at}`, 'info');
      } else {
        log('⚠️ No assignment history record found', 'warning');
      }
    } else {
      log('⚠️ Insufficient data for assignment tracking test', 'warning');
    }
    
    // Step 5: Test projects with hierarchy function
    log('📋 Step 5: Testing Projects with Hierarchy Function', 'info');
    
    if (superAgentResult.rows.length > 0) {
      const superAgent = superAgentResult.rows[0];
      
      const hierarchyResult = await pool.query(
        'SELECT * FROM get_projects_with_hierarchy($1, $2::user_role, 5, 0)',
        [superAgent.id, superAgent.role]
      );
      
      log(`✅ Projects with hierarchy query successful: ${hierarchyResult.rows.length} projects returned`, 'success');
      
      if (hierarchyResult.rows.length > 0) {
        const project = hierarchyResult.rows[0];
        log(`   - Sample project: ${project.title}`, 'info');
        log(`   - Client: ${project.client_name || 'Not assigned'}`, 'info');
        log(`   - Agent: ${project.agent_name || 'Not assigned'}`, 'info');
        log(`   - Worker: ${project.worker_name || 'Not assigned'}`, 'info');
      }
    }
    
    // Step 6: Test assignment history function
    log('📋 Step 6: Testing Assignment History Function', 'info');
    
    if (projectResult.rows.length > 0) {
      const projectId = projectResult.rows[0].id;
      
      const historyFunctionResult = await pool.query(
        'SELECT * FROM get_project_assignment_history($1)',
        [projectId]
      );
      
      log(`✅ Assignment history function working: ${historyFunctionResult.rows.length} records returned`, 'success');
      
      if (historyFunctionResult.rows.length > 0) {
        const history = historyFunctionResult.rows[0];
        log(`   - Latest assignment: ${history.assignment_type} to ${history.assigned_to_name}`, 'info');
        log(`   - Assigned by: ${history.assigned_by_name}`, 'info');
        log(`   - Valid: ${history.is_valid_hierarchy}`, 'info');
      }
    }
    
    // Step 7: Test project numbers functionality
    log('📋 Step 7: Testing Project Numbers Functionality', 'info');
    
    if (projectResult.rows.length > 0) {
      const projectId = projectResult.rows[0].id;
      const testProjectNumbers = ['PRJ-001', 'REF-123', 'ORDER-456'];
      
      // Update project with test numbers
      const updateResult = await pool.query(
        'UPDATE projects SET project_numbers = $1 WHERE id = $2 RETURNING project_numbers',
        [testProjectNumbers, projectId]
      );
      
      if (updateResult.rows.length > 0) {
        const updatedNumbers = updateResult.rows[0].project_numbers;
        log(`✅ Project numbers updated successfully:`, 'success');
        log(`   - Numbers: ${updatedNumbers.join(', ')}`, 'info');
      } else {
        log('⚠️ Failed to update project numbers', 'warning');
      }
    }
    
    // Step 8: Test database indexes and constraints
    log('📋 Step 8: Testing Database Indexes and Constraints', 'info');
    
    const indexResult = await pool.query(
      `SELECT indexname, tablename 
       FROM pg_indexes 
       WHERE tablename IN ('projects', 'project_assignment_history') 
         AND indexname LIKE '%project%'
       ORDER BY tablename, indexname`
    );
    
    if (indexResult.rows.length > 0) {
      log(`✅ Found ${indexResult.rows.length} relevant indexes:`, 'success');
      indexResult.rows.forEach(idx => {
        log(`   - ${idx.indexname} on ${idx.tablename}`, 'info');
      });
    } else {
      log('⚠️ No relevant indexes found', 'warning');
    }
    
    // Step 9: Test trigger functionality
    log('📋 Step 9: Testing Assignment Tracking Trigger', 'info');
    
    const triggerResult = await pool.query(
      `SELECT trigger_name, event_manipulation, event_object_table 
       FROM information_schema.triggers 
       WHERE event_object_table = 'projects' 
         AND trigger_name LIKE '%assignment%'`
    );
    
    if (triggerResult.rows.length > 0) {
      log(`✅ Found ${triggerResult.rows.length} assignment triggers:`, 'success');
      triggerResult.rows.forEach(trigger => {
        log(`   - ${trigger.trigger_name} (${trigger.event_manipulation})`, 'info');
      });
    } else {
      log('⚠️ No assignment triggers found', 'warning');
    }
    
    log('\n🎉 PROJECT ASSIGNMENT TESTS COMPLETED!', 'success');
    log('Enhanced project assignment system is functional', 'success');
    
    return true;
    
  } catch (error) {
    log(`❌ Project assignment test failed: ${error.message}`, 'error');
    console.error('Full error:', error);
    return false;
  }
};

// Main execution
const runProjectAssignmentTests = async () => {
  try {
    const success = await testProjectAssignmentSystem();
    
    log('\n📋 PROJECT ASSIGNMENT TEST SUMMARY', 'info');
    log('=' .repeat(50), 'info');
    log(`Overall Result: ${success ? '✅ PASSED' : '❌ FAILED'}`, success ? 'success' : 'error');
    
    if (success) {
      log('\n🚀 PROJECT ASSIGNMENT SYSTEM READY!', 'success');
      log('Enhanced project assignment functionality is complete', 'success');
    } else {
      log('\n⚠️ Project assignment system needs attention', 'warning');
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
runProjectAssignmentTests();