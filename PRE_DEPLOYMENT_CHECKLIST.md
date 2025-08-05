# Pre-Deployment Checklist

## 🗄️ Database Migration (REQUIRED FIRST)

### Step 1: Run the SQL Migration Script
**IMPORTANT: Run this in your Supabase SQL Editor BEFORE deploying the application**

```sql
-- Copy and paste the entire content of database_migration.sql into Supabase SQL Editor
-- This script includes:
-- 1. New project statuses ('refund', 'cancelled')
-- 2. New columns (order_reference, deadline_charge, urgency_level)
-- 3. New tables (deadline_extension_requests, notification_history)
-- 4. Indexes for performance
-- 5. RLS policies for security
-- 6. Utility functions
```

### Step 2: Verify Database Changes
After running the migration, verify these tables and columns exist:

**Projects table should have:**
- `order_reference` VARCHAR(20) UNIQUE
- `deadline_charge` DECIMAL(10,2) DEFAULT 0
- `urgency_level` urgency_level DEFAULT 'normal'

**New tables should exist:**
- `deadline_extension_requests`
- `notification_history`

**New enum values:**
- project_status should include 'refund' and 'cancelled'

### Step 3: Test Database Connection
Run this query to verify everything is working:
```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name IN ('order_reference', 'deadline_charge', 'urgency_level');
```

## 🧪 Testing Validation

### ✅ Core Tests Status
- **End-to-End Integration Tests**: 17/17 PASSING ✅
- **Build Process**: SUCCESSFUL ✅
- **TypeScript Compilation**: NO ERRORS ✅

### Run Final Test Suite
```bash
npm run test:run -- tests/endToEndIntegration.test.ts
```

Expected result: All 17 tests should pass.

## 🔧 Environment Configuration

### Required Environment Variables
Ensure these are set in your production environment:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# VAPID Keys for Push Notifications (IMPORTANT!)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

### VAPID Keys Setup
1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Update `services/notificationService.ts` with your public key
3. Add both keys to Supabase Edge Functions secrets

## 📋 Feature Validation Checklist

### ✅ Notification System
- [ ] Notifications send successfully
- [ ] Retry mechanism works for failed notifications
- [ ] Notification history is tracked in database
- [ ] All project status changes trigger notifications

### ✅ Dashboard Filtering
- [ ] Week/Month/Custom date filters work
- [ ] Earnings calculations are accurate
- [ ] Currency conversion (GBP to INR) displays correctly
- [ ] Profit calculations show "Profit £X / To Give £Y" format

### ✅ Order Reference System
- [ ] New projects get unique order references
- [ ] Order references follow "ORD-YYYY-MM-XXXXXX" format
- [ ] Search by order reference works
- [ ] Order references display in all project modals

### ✅ Enhanced Pricing
- [ ] Deadline-based pricing calculates correctly
- [ ] Urgency levels are assigned properly
- [ ] Pricing breakdown shows base price + deadline charge

### ✅ Worker Features
- [ ] Project cancellation works (sets status to 'refund')
- [ ] Deadline extension requests can be submitted
- [ ] Earnings display with filtering works

### ✅ Agent Features
- [ ] Profit tracking with filtering works
- [ ] Advanced project filtering (client ID, order reference)
- [ ] Analytics dashboard with charts
- [ ] Worker payment summaries

### ✅ UI/UX Enhancements
- [ ] Smooth animations and transitions
- [ ] Responsive design on mobile/tablet
- [ ] Loading states work properly
- [ ] Error handling is user-friendly

## 🚀 Deployment Steps

### 1. Database Migration
```sql
-- Run database_migration.sql in Supabase SQL Editor
```

### 2. Environment Setup
- Set all required environment variables
- Configure VAPID keys for push notifications

### 3. Build and Deploy
```bash
npm run build
# Deploy dist/ folder to your hosting platform
```

### 4. Post-Deployment Verification
- [ ] Application loads without errors
- [ ] User authentication works
- [ ] Database connections are successful
- [ ] Notifications can be sent
- [ ] All dashboard features work

## 🔍 Monitoring and Health Checks

### Key Metrics to Monitor
- **Notification Delivery Rate**: Should be > 95%
- **Database Query Performance**: Monitor slow queries
- **Error Rates**: Should be < 1%
- **User Experience**: Page load times < 3 seconds

### Health Check Endpoints
Create these monitoring endpoints:
- `/health` - Basic application health
- `/health/database` - Database connectivity
- `/health/notifications` - Notification system status

## 🐛 Troubleshooting

### Common Issues and Solutions

**Issue: Notifications not sending**
- Check VAPID keys are configured correctly
- Verify Supabase Edge Functions are deployed
- Check browser notification permissions

**Issue: Database errors**
- Verify migration script ran successfully
- Check RLS policies are enabled
- Ensure user has proper permissions

**Issue: Order references not generating**
- Check if order_reference column exists
- Verify unique constraint is in place
- Check OrderReferenceGenerator service

**Issue: Calculations incorrect**
- Verify WORKER_PAY_RATE_PER_500_WORDS constant
- Check GBP_TO_INR_RATE is current
- Validate project data integrity

## 📞 Support Contacts

If you encounter issues during deployment:
1. Check the browser console for JavaScript errors
2. Check Supabase logs for database errors
3. Verify all environment variables are set
4. Test with a fresh browser session

## ✅ Final Deployment Approval

Before going live, confirm:
- [ ] Database migration completed successfully
- [ ] All tests pass
- [ ] Environment variables configured
- [ ] VAPID keys set up for notifications
- [ ] Application builds without errors
- [ ] Core features tested manually
- [ ] Performance is acceptable
- [ ] Security measures in place

**Deployment Ready**: ✅ YES / ❌ NO

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Migration Script**: database_migration.sql