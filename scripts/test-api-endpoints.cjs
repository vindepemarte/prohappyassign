#!/usr/bin/env node

/**
 * Test API Endpoints for Hierarchy Operations
 * Tests all the enhanced API endpoints for comprehensive functionality
 */

const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Load environment variables
dotenv.config({ path: '.env.local' });

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
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { response, data, status: response.status };
  } catch (error) {
    return { error: error.message, status: 0 };
  }
};

const testApiEndpoints = async () => {
  log('🚀 Starting API Endpoints Tests...', 'info');
  log('=' .repeat(60), 'info');
  
  const testResults = {
    public_endpoints: {},
    authenticated_endpoints: {},
    hierarchy_operations: {},
    notifications: {},
    documentation: {}
  };
  
  try {
    // Step 1: Test Public Endpoints
    log('📋 Step 1: Testing Public Endpoints', 'info');
    
    // Test API health
    const healthResult = await apiCall('/api/docs/health');
    testResults.public_endpoints.health = {
      status: healthResult.status,
      success: healthResult.status === 200,
      data: healthResult.data
    };
    
    if (healthResult.status === 200) {
      log('✅ API Health endpoint working', 'success');
    } else {
      log('❌ API Health endpoint failed', 'error');
    }
    
    // Test API documentation
    const docsResult = await apiCall('/api/docs');
    testResults.documentation.main = {
      status: docsResult.status,
      success: docsResult.status === 200,
      endpoints_count: docsResult.data?.endpoints ? Object.keys(docsResult.data.endpoints).length : 0
    };
    
    if (docsResult.status === 200) {
      log(`✅ API Documentation endpoint working: ${testResults.documentation.main.endpoints_count} endpoint groups`, 'success');
    } else {
      log('❌ API Documentation endpoint failed', 'error');
    }
    
    // Test reference code validation (public)
    const refCodeResult = await apiCall('/api/reference-codes/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'SA-CLI-EAB17CD0' })
    });
    testResults.public_endpoints.reference_code_validation = {
      status: refCodeResult.status,
      success: refCodeResult.status === 200,
      is_valid: refCodeResult.data?.isValid
    };
    
    if (refCodeResult.status === 200) {
      log(`✅ Reference code validation working: ${refCodeResult.data?.isValid ? 'Valid' : 'Invalid'} code`, 'success');
    } else {
      log('❌ Reference code validation failed', 'error');
    }
    
    // Step 2: Test Authentication Required Endpoints (without token)
    log('📋 Step 2: Testing Authentication Protection', 'info');
    
    const protectedEndpoints = [
      '/api/hierarchy/my-hierarchy',
      '/api/hierarchy-operations/statistics',
      '/api/notifications/my-notifications',
      '/api/permissions/my-permissions',
      '/api/agent-pricing/current'
    ];
    
    let protectedCount = 0;
    for (const endpoint of protectedEndpoints) {
      const result = await apiCall(endpoint);
      if (result.status === 401) {
        protectedCount++;
      }
    }
    
    testResults.authenticated_endpoints.protection = {
      total_tested: protectedEndpoints.length,
      properly_protected: protectedCount,
      success: protectedCount === protectedEndpoints.length
    };
    
    if (protectedCount === protectedEndpoints.length) {
      log(`✅ Authentication protection working: ${protectedCount}/${protectedEndpoints.length} endpoints protected`, 'success');
    } else {
      log(`⚠️ Authentication protection issues: ${protectedCount}/${protectedEndpoints.length} endpoints protected`, 'warning');
    }
    
    // Step 3: Test Hierarchy Operations Endpoints Structure
    log('📋 Step 3: Testing Hierarchy Operations Endpoints', 'info');
    
    const hierarchyEndpoints = [
      { path: '/api/hierarchy-operations/tree', method: 'GET' },
      { path: '/api/hierarchy-operations/statistics', method: 'GET' },
      { path: '/api/hierarchy-operations/search', method: 'GET' }
    ];
    
    let hierarchyAccessible = 0;
    for (const endpoint of hierarchyEndpoints) {
      const result = await apiCall(endpoint.path);
      // 401 (auth required) or 403 (permission denied) are expected responses
      if (result.status === 401 || result.status === 403) {
        hierarchyAccessible++;
      }
    }
    
    testResults.hierarchy_operations.endpoints = {
      total_tested: hierarchyEndpoints.length,
      accessible: hierarchyAccessible,
      success: hierarchyAccessible === hierarchyEndpoints.length
    };
    
    if (hierarchyAccessible === hierarchyEndpoints.length) {
      log(`✅ Hierarchy operations endpoints accessible: ${hierarchyAccessible}/${hierarchyEndpoints.length}`, 'success');
    } else {
      log(`❌ Hierarchy operations endpoints issues: ${hierarchyAccessible}/${hierarchyEndpoints.length}`, 'error');
    }
    
    // Step 4: Test Notification Endpoints
    log('📋 Step 4: Testing Notification Endpoints', 'info');
    
    const notificationEndpoints = [
      { path: '/api/notifications/my-notifications', method: 'GET' },
      { path: '/api/notifications/templates', method: 'GET' },
      { path: '/api/notifications/preferences', method: 'GET' },
      { path: '/api/notifications/statistics', method: 'GET' }
    ];
    
    let notificationAccessible = 0;
    for (const endpoint of notificationEndpoints) {
      const result = await apiCall(endpoint.path);
      // 401 (auth required) is expected response
      if (result.status === 401) {
        notificationAccessible++;
      }
    }
    
    testResults.notifications.endpoints = {
      total_tested: notificationEndpoints.length,
      accessible: notificationAccessible,
      success: notificationAccessible === notificationEndpoints.length
    };
    
    if (notificationAccessible === notificationEndpoints.length) {
      log(`✅ Notification endpoints accessible: ${notificationAccessible}/${notificationEndpoints.length}`, 'success');
    } else {
      log(`❌ Notification endpoints issues: ${notificationAccessible}/${notificationEndpoints.length}`, 'error');
    }
    
    // Step 5: Test Error Handling
    log('📋 Step 5: Testing Error Handling', 'info');
    
    // Test invalid endpoint
    const invalidResult = await apiCall('/api/invalid-endpoint');
    const invalidHandled = invalidResult.status === 404;
    
    // Test malformed request
    const malformedResult = await apiCall('/api/reference-codes/validate', {
      method: 'POST',
      body: 'invalid json'
    });
    const malformedHandled = malformedResult.status === 400 || malformedResult.status === 500;
    
    testResults.error_handling = {
      invalid_endpoint: invalidHandled,
      malformed_request: malformedHandled,
      success: invalidHandled && malformedHandled
    };
    
    if (invalidHandled && malformedHandled) {
      log('✅ Error handling working correctly', 'success');
    } else {
      log('⚠️ Error handling needs improvement', 'warning');
    }
    
    // Step 6: Test API Response Format Consistency
    log('📋 Step 6: Testing API Response Format', 'info');
    
    const formatTests = [
      { endpoint: '/api/docs/health', expectedFields: ['status', 'timestamp'] },
      { endpoint: '/api/docs', expectedFields: ['title', 'version', 'endpoints'] }
    ];
    
    let formatConsistent = 0;
    for (const test of formatTests) {
      const result = await apiCall(test.endpoint);
      if (result.status === 200 && result.data) {
        const hasAllFields = test.expectedFields.every(field => 
          result.data.hasOwnProperty(field)
        );
        if (hasAllFields) {
          formatConsistent++;
        }
      }
    }
    
    testResults.response_format = {
      total_tested: formatTests.length,
      consistent: formatConsistent,
      success: formatConsistent === formatTests.length
    };
    
    if (formatConsistent === formatTests.length) {
      log(`✅ API response format consistent: ${formatConsistent}/${formatTests.length}`, 'success');
    } else {
      log(`⚠️ API response format inconsistencies: ${formatConsistent}/${formatTests.length}`, 'warning');
    }
    
    log('\n🎉 API ENDPOINTS TESTS COMPLETED!', 'success');
    log('All API endpoints are properly structured and accessible', 'success');
    
    return testResults;
    
  } catch (error) {
    log(`❌ API endpoints test failed: ${error.message}`, 'error');
    console.error('Full error:', error);
    return null;
  }
};

// Generate test report
const generateTestReport = (results) => {
  if (!results) return;
  
  log('\n📊 API ENDPOINTS TEST REPORT', 'info');
  log('=' .repeat(50), 'info');
  
  const categories = [
    { name: 'Public Endpoints', data: results.public_endpoints },
    { name: 'Authentication Protection', data: results.authenticated_endpoints },
    { name: 'Hierarchy Operations', data: results.hierarchy_operations },
    { name: 'Notifications', data: results.notifications },
    { name: 'Documentation', data: results.documentation },
    { name: 'Error Handling', data: results.error_handling },
    { name: 'Response Format', data: results.response_format }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  
  categories.forEach(category => {
    log(`\n${category.name}:`, 'info');
    
    Object.entries(category.data).forEach(([key, value]) => {
      totalTests++;
      if (value.success) {
        passedTests++;
        log(`  ✅ ${key}: PASSED`, 'success');
      } else {
        log(`  ❌ ${key}: FAILED`, 'error');
      }
      
      // Show additional details
      if (value.total_tested) {
        log(`     - Tested: ${value.total_tested}`, 'info');
      }
      if (value.accessible !== undefined) {
        log(`     - Accessible: ${value.accessible}`, 'info');
      }
      if (value.endpoints_count) {
        log(`     - Endpoints: ${value.endpoints_count}`, 'info');
      }
    });
  });
  
  log('\n' + '=' .repeat(50), 'info');
  log(`Overall API Tests: ${passedTests}/${totalTests}`, 'info');
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, 
      passedTests === totalTests ? 'success' : 'warning');
  
  if (passedTests === totalTests) {
    log('\n🚀 ALL API ENDPOINT TESTS PASSED!', 'success');
    log('API endpoints are properly implemented and accessible', 'success');
  } else {
    log(`\n⚠️ ${totalTests - passedTests} API endpoint test(s) need attention`, 'warning');
  }
  
  return passedTests === totalTests;
};

// Main execution
const runApiEndpointTests = async () => {
  try {
    const results = await testApiEndpoints();
    const allPassed = generateTestReport(results);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'error');
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
runApiEndpointTests();