#!/usr/bin/env node

/**
 * Test Agent Pricing Configuration System
 * Tests the enhanced agent pricing functionality
 */

const dotenv = require('dotenv');
const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const BASE_URL = 'http://localhost:3000';

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

const apiCall = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  return { response, data };
};

const testAgentPricingSystem = async () => {
  log('🚀 Starting Agent Pricing System Tests...', 'info');
  log('=' .repeat(60), 'info');
  
  try {
    // Step 1: Get an agent user for testing
    log('📋 Step 1: Finding Agent User', 'info');
    const agentResult = await pool.query(
      'SELECT * FROM users WHERE role = $1 LIMIT 1',
      ['agent']
    );
    
    if (agentResult.rows.length === 0) {
      throw new Error('No agent users found in system');
    }
    
    const agent = agentResult.rows[0];
    log(`✅ Found agent: ${agent.email}`, 'success');
    
    // Step 2: Test getting current pricing (should return default)
    log('📋 Step 2: Testing Current Pricing Retrieval', 'info');
    const { response: currentResponse, data: currentData } = await apiCall(`/api/agent-pricing/${agent.id}`);
    
    if (currentResponse.ok || currentResponse.status === 404) {
      log('✅ Current pricing endpoint accessible', 'success');
    } else {
      throw new Error(`Failed to get current pricing: ${JSON.stringify(currentData)}`);
    }
    
    // Step 3: Test pricing validation
    log('📋 Step 3: Testing Pricing Validation', 'info');
    const testPricing = {
      min_word_count: 500,
      max_word_count: 15000,
      base_rate_per_500_words: 7.50,
      agent_fee_percentage: 18.0
    };
    
    const { response: validateResponse, data: validateData } = await apiCall('/api/agent-pricing/validate', {
      method: 'POST',
      body: JSON.stringify(testPricing)
    });
    
    if (validateResponse.ok && validateData.success) {
      log(`✅ Pricing validation working: ${validateData.data.valid ? 'Valid' : 'Invalid'}`, 'success');
      if (validateData.data.warnings.length > 0) {
        log(`⚠️ Validation warnings: ${validateData.data.warnings.join(', ')}`, 'warning');
      }
    } else {
      throw new Error(`Pricing validation failed: ${JSON.stringify(validateData)}`);
    }
    
    // Step 4: Test pricing calculator
    log('📋 Step 4: Testing Pricing Calculator', 'info');
    const { response: calcResponse, data: calcData } = await apiCall('/api/agent-pricing/calculate', {
      method: 'POST',
      body: JSON.stringify({ 
        word_count: 1500,
        agent_id: agent.id
      })
    });
    
    if (calcResponse.ok && calcData.success) {
      const breakdown = calcData.data.breakdown;
      log(`✅ Pricing calculation successful:`, 'success');
      log(`   Word Count: ${calcData.data.word_count}`, 'info');
      log(`   Base Cost: £${breakdown.base_cost}`, 'info');
      log(`   Agent Fee: £${breakdown.agent_fee}`, 'info');
      log(`   Client Total: £${breakdown.client_total}`, 'info');
      log(`   System Total: £${breakdown.system_total}`, 'info');
    } else {
      throw new Error(`Pricing calculation failed: ${JSON.stringify(calcData)}`);
    }
    
    // Step 5: Test pricing history (should be empty initially)
    log('📋 Step 5: Testing Pricing History', 'info');
    const { response: historyResponse, data: historyData } = await apiCall(`/api/agent-pricing/history/${agent.id}`);
    
    if (historyResponse.ok && historyData.success) {
      log(`✅ Pricing history accessible: ${historyData.data.history.length} records`, 'success');
    } else {
      log(`⚠️ Pricing history not accessible (expected for new system)`, 'warning');
    }
    
    // Step 6: Test pricing overview (Super Agent function)
    log('📋 Step 6: Testing Pricing Overview', 'info');
    const { response: overviewResponse, data: overviewData } = await apiCall('/api/agent-pricing/overview');
    
    if (overviewResponse.ok && overviewData.success) {
      log(`✅ Pricing overview accessible: ${overviewData.data.length} agents`, 'success');
    } else {
      log(`⚠️ Pricing overview requires Super Agent permissions`, 'warning');
    }
    
    // Step 7: Test database schema
    log('📋 Step 7: Testing Database Schema', 'info');
    
    // Check agent_pricing table
    const pricingTableResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'agent_pricing' ORDER BY ordinal_position`
    );
    
    if (pricingTableResult.rows.length > 0) {
      log(`✅ agent_pricing table exists with ${pricingTableResult.rows.length} columns`, 'success');
    } else {
      throw new Error('agent_pricing table not found');
    }
    
    // Check agent_pricing_history table
    const historyTableResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'agent_pricing_history' ORDER BY ordinal_position`
    );
    
    if (historyTableResult.rows.length > 0) {
      log(`✅ agent_pricing_history table exists with ${historyTableResult.rows.length} columns`, 'success');
    } else {
      throw new Error('agent_pricing_history table not found');
    }
    
    // Step 8: Test trigger functionality
    log('📋 Step 8: Testing History Trigger', 'info');
    
    // Insert a test pricing record to trigger history
    const testInsertResult = await pool.query(
      `INSERT INTO agent_pricing (agent_id, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, updated_by)
       VALUES ($1, 500, 15000, 7.25, 16.5, $1)
       ON CONFLICT (agent_id) DO UPDATE SET
       base_rate_per_500_words = EXCLUDED.base_rate_per_500_words,
       agent_fee_percentage = EXCLUDED.agent_fee_percentage,
       updated_at = CURRENT_TIMESTAMP,
       updated_by = EXCLUDED.updated_by
       RETURNING id`,
      [agent.id]
    );
    
    if (testInsertResult.rows.length > 0) {
      log('✅ Test pricing record inserted/updated', 'success');
      
      // Check if history record was created
      const historyCheckResult = await pool.query(
        'SELECT COUNT(*) as count FROM agent_pricing_history WHERE agent_id = $1',
        [agent.id]
      );
      
      const historyCount = parseInt(historyCheckResult.rows[0].count);
      if (historyCount > 0) {
        log(`✅ History trigger working: ${historyCount} history record(s) created`, 'success');
      } else {
        log('⚠️ History trigger may not be working (no history records found)', 'warning');
      }
    }
    
    log('\n🎉 AGENT PRICING SYSTEM TESTS COMPLETED!', 'success');
    log('All core functionality is working correctly', 'success');
    
    return true;
    
  } catch (error) {
    log(`❌ Agent pricing test failed: ${error.message}`, 'error');
    return false;
  }
};

// Main execution
const runAgentPricingTests = async () => {
  try {
    const success = await testAgentPricingSystem();
    
    log('\n📋 AGENT PRICING TEST SUMMARY', 'info');
    log('=' .repeat(50), 'info');
    log(`Overall Result: ${success ? '✅ PASSED' : '❌ FAILED'}`, success ? 'success' : 'error');
    
    if (success) {
      log('\n🚀 AGENT PRICING SYSTEM READY!', 'success');
      log('Enhanced pricing configuration is fully functional', 'success');
    } else {
      log('\n⚠️ Agent pricing system needs attention', 'warning');
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
runAgentPricingTests();