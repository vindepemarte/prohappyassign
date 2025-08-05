#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Run this script to validate that everything is ready for deployment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting Deployment Validation...\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - File missing: ${filePath}`, 'red');
    return false;
  }
}

function runCommand(command, description) {
  try {
    log(`🔍 ${description}...`, 'blue');
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    log(`✅ ${description}`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} - Error: ${error.message}`, 'red');
    return false;
  }
}

let allChecksPass = true;

// 1. Check required files exist
log('📁 Checking Required Files...', 'yellow');
const requiredFiles = [
  ['database_migration.sql', 'Database migration script'],
  ['services/orderReferenceGenerator.ts', 'Order reference generator'],
  ['services/pricingCalculator.ts', 'Pricing calculator'],
  ['utils/earningsCalculator.ts', 'Earnings calculator'],
  ['utils/profitCalculator.ts', 'Profit calculator'],
  ['services/notificationService.ts', 'Notification service'],
  ['services/notificationTracker.ts', 'Notification tracker'],
  ['components/common/FilterBar.tsx', 'Filter bar component'],
  ['PRE_DEPLOYMENT_CHECKLIST.md', 'Deployment checklist']
];

requiredFiles.forEach(([file, description]) => {
  if (!checkFile(file, description)) {
    allChecksPass = false;
  }
});

// 2. Check TypeScript compilation
log('\n🔧 Checking TypeScript Compilation...', 'yellow');
if (!runCommand('npx tsc --noEmit --skipLibCheck', 'TypeScript compilation check')) {
  allChecksPass = false;
}

// 3. Check build process
log('\n🏗️ Checking Build Process...', 'yellow');
if (!runCommand('npm run build', 'Production build')) {
  allChecksPass = false;
}

// 4. Run core tests
log('\n🧪 Running Core Tests...', 'yellow');
if (!runCommand('npm run test:run -- tests/endToEndIntegration.test.ts', 'End-to-end integration tests')) {
  allChecksPass = false;
}

// 5. Check environment configuration
log('\n🌍 Checking Environment Configuration...', 'yellow');
const envFile = '.env.local';
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  let envChecksPass = true;
  requiredEnvVars.forEach(envVar => {
    if (envContent.includes(envVar)) {
      log(`✅ ${envVar} is configured`, 'green');
    } else {
      log(`❌ ${envVar} is missing from environment`, 'red');
      envChecksPass = false;
      allChecksPass = false;
    }
  });
  
  if (envChecksPass) {
    log('✅ Environment configuration looks good', 'green');
  }
} else {
  log('⚠️  .env.local file not found - make sure environment variables are set in production', 'yellow');
}

// 6. Check VAPID key configuration
log('\n🔔 Checking Notification Configuration...', 'yellow');
const notificationServicePath = 'services/notificationService.ts';
if (fs.existsSync(notificationServicePath)) {
  const notificationContent = fs.readFileSync(notificationServicePath, 'utf8');
  if (notificationContent.includes('REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY')) {
    log('❌ VAPID public key needs to be updated in notificationService.ts', 'red');
    allChecksPass = false;
  } else {
    log('✅ VAPID public key appears to be configured', 'green');
  }
}

// 7. Check database migration script
log('\n🗄️ Checking Database Migration Script...', 'yellow');
const migrationPath = 'database_migration.sql';
if (fs.existsSync(migrationPath)) {
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  const requiredMigrations = [
    'ALTER TYPE project_status ADD VALUE',
    'ADD COLUMN IF NOT EXISTS order_reference',
    'CREATE TABLE IF NOT EXISTS deadline_extension_requests',
    'CREATE TABLE IF NOT EXISTS notification_history'
  ];
  
  let migrationChecksPass = true;
  requiredMigrations.forEach(migration => {
    if (migrationContent.includes(migration)) {
      log(`✅ Migration includes: ${migration}`, 'green');
    } else {
      log(`❌ Migration missing: ${migration}`, 'red');
      migrationChecksPass = false;
      allChecksPass = false;
    }
  });
  
  if (migrationChecksPass) {
    log('✅ Database migration script looks complete', 'green');
  }
}

// 8. Final validation summary
log('\n📊 Validation Summary', 'yellow');
log('='.repeat(50), 'blue');

if (allChecksPass) {
  log('🎉 ALL CHECKS PASSED! Ready for deployment.', 'green');
  log('\nNext steps:', 'blue');
  log('1. Run the database migration script in Supabase SQL Editor', 'blue');
  log('2. Configure VAPID keys for push notifications', 'blue');
  log('3. Set up production environment variables', 'blue');
  log('4. Deploy the application', 'blue');
  log('5. Run post-deployment verification', 'blue');
} else {
  log('❌ SOME CHECKS FAILED! Please fix the issues above before deploying.', 'red');
  process.exit(1);
}

log('\n📋 See PRE_DEPLOYMENT_CHECKLIST.md for detailed deployment instructions.', 'blue');
log('🗄️ Database migration script: database_migration.sql', 'blue');

console.log('\n✨ Validation complete!');