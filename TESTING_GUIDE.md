# Testing Guide - Complete System Validation

This guide will help you test the complete pricing and notification system locally.

## Prerequisites

1. **Database Setup**: Make sure you have PostgreSQL running and your `DATABASE_URL` environment variable set
2. **Environment Variables**: Ensure you have the following set:
   ```bash
   DATABASE_URL=postgresql://user:password@localhost:5432/your_database
   JWT_SECRET=your-secret-key
   PORT=3000
   ```

## Quick Test (Recommended)

Run the complete setup and testing script:

```bash
node scripts/setup-and-test-local.js
```

This script will:
1. ✅ Check database connection
2. 🔄 Run all database migrations
3. 🚀 Start the server (if not running)
4. 🧪 Run complete workflow tests

## Manual Testing Steps

If you prefer to run things step by step:

### 1. Run Database Migrations

```bash
node scripts/run-migrations.js
```

### 2. Start Your Server

```bash
npm start
# or
node server.js
```

### 3. Run Complete Workflow Tests

```bash
node scripts/test-complete-workflows.js
```

## What Gets Tested

### 🧪 Pricing System Tests
- ✅ Super Agent pricing (£45-£440 for 500-20,000 words)
- ✅ Urgency pricing (£30 next day, £10 for 2-3 days, £5 for 4-7 days)
- ✅ Super Worker earnings (£6.25 per 500 words in GBP & INR)
- ✅ Agent custom pricing integration

### 🔔 Notification System Tests
- ✅ Super Agent broadcast notifications
- ✅ Targeted notifications between roles
- ✅ Notification history retrieval
- ✅ Subordinate relationship queries

### 📊 Analytics System Tests
- ✅ Super Worker analytics (earnings in GBP & INR)
- ✅ Super Agent analytics (revenue - fees = profit)
- ✅ Agent analytics (earnings - Super Agent fees)
- ✅ Dashboard summaries for all roles

### 🔐 Security Tests
- ✅ Role-based access control
- ✅ Hierarchy permission validation
- ✅ Proper error responses (403, 401, 400)

### 🗄️ Database Integrity Tests
- ✅ Super Agent pricing table (40 tiers)
- ✅ User hierarchy relationships
- ✅ Required tables and indexes

## Test Results

The test will show you:

```
🏁 FINAL TEST RESULTS
============================================================
✅ Pricing Calculations: PASSED
✅ Super Worker Earnings: PASSED
✅ Notification System: PASSED
✅ Analytics System: PASSED
✅ Role-Based Access Control: PASSED
✅ Database Integrity: PASSED

📊 SUMMARY:
Total Tests: 6
Passed: 6
Failed: 0
Success Rate: 100.0%

🎉 ALL TESTS PASSED! System is working correctly.
```

## Test Users Created

The test creates these temporary users (automatically cleaned up):

- **Super Agent**: `test-super-agent@workflow.com`
- **Agent**: `test-agent@workflow.com`
- **Super Worker**: `test-super-worker@workflow.com`
- **Client**: `test-client@workflow.com`

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
pg_isready

# Test connection manually
psql $DATABASE_URL -c "SELECT 1;"
```

### Server Not Starting
```bash
# Check if port is in use
lsof -i :3000

# Start server manually
NODE_ENV=development node server.js
```

### Migration Issues
```bash
# Check migration status
node -e "
import { Pool } from 'pg';
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT * FROM schema_migrations ORDER BY executed_at').then(r => console.log(r.rows));
"
```

### Test Failures

If tests fail, check:

1. **Server is running**: Visit `http://localhost:3000/health`
2. **Database is accessible**: Can you connect with your DATABASE_URL?
3. **Migrations completed**: Check the migration status
4. **Environment variables**: Are JWT_SECRET and DATABASE_URL set?

## Individual Test Scripts

You can also run individual test components:

```bash
# Just pricing tests
node -e "import('./scripts/test-complete-workflows.js').then(m => m.testPricingCalculations())"

# Just notification tests  
node -e "import('./scripts/test-complete-workflows.js').then(m => m.testNotificationSystem())"

# Just analytics tests
node -e "import('./scripts/test-complete-workflows.js').then(m => m.testAnalyticsSystem())"
```

## Expected Behavior

### Pricing Calculations
- 500 words → £45 base price
- 1000 words → £55 base price  
- 20000 words → £440 base price
- Next day delivery → +£30 urgency charge
- 2-3 days → +£10 urgency charge
- 4-7 days → +£5 urgency charge

### Super Worker Earnings
- 500 words → £6.25 (₹659.375)
- 750 words → £12.50 (₹1,318.75) - rounds up to 2 units
- 1000 words → £12.50 (₹1,318.75)

### Notifications
- Super Agent can broadcast to all users
- Agents can send to their clients
- Users can retrieve their notification history
- Proper permission checks prevent unauthorized access

### Analytics
- Super Worker: Shows earnings in both GBP and INR
- Super Agent: Shows total revenue, fees paid, and net profit
- Agent: Shows earnings and fees owed to Super Agent

## Success Criteria

✅ **All tests pass** - System is ready for production
⚠️ **Some tests fail** - Review issues and fix before deployment
❌ **Many tests fail** - System needs significant fixes

The system is considered ready when all 6 test categories pass with 100% success rate.