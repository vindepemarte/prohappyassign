# Database Schema Updates - Comprehensive App Enhancement

This document outlines the database schema updates implemented for the comprehensive app enhancement feature.

## Overview

The database schema has been updated to support:
- New project statuses (`refund`, `cancelled`)
- Order reference system with unique identifiers
- Deadline-based pricing with urgency levels
- Deadline extension request system
- Notification delivery tracking and retry mechanism

## Migration File

**Location**: `supabase/migrations/20250108000001_comprehensive_app_enhancements.sql`

### Changes Made

#### 1. Project Status Updates
- Added `refund` and `cancelled` to the `project_status` enum
- These statuses support the new project cancellation workflow

#### 2. Projects Table Enhancements
```sql
ALTER TABLE projects 
ADD COLUMN order_reference VARCHAR(20) UNIQUE,
ADD COLUMN deadline_charge DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN urgency_level VARCHAR(20) DEFAULT 'normal';
```

**New Columns:**
- `order_reference`: Unique identifier in format "ORD-YYYY-MM-XXXXXX"
- `deadline_charge`: Additional charge based on deadline urgency (in GBP)
- `urgency_level`: Urgency classification (normal, moderate, urgent, rush)

#### 3. Deadline Extension Requests Table
```sql
CREATE TABLE deadline_extension_requests (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Tracks worker requests for deadline extensions with approval workflow.

#### 4. Notification History Table
```sql
CREATE TABLE notification_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
```

**Purpose**: Tracks notification delivery status and enables retry mechanisms.

#### 5. Performance Indexes
- `idx_projects_order_reference`: Fast lookup by order reference
- `idx_deadline_extension_requests_project_id`: Fast project-based queries
- `idx_deadline_extension_requests_worker_id`: Fast worker-based queries
- `idx_notification_history_user_id`: Fast user notification queries
- `idx_notification_history_project_id`: Fast project notification queries
- `idx_notification_history_delivery_status`: Fast status-based queries

#### 6. Database Functions
- `update_updated_at_column()`: Trigger function for automatic timestamp updates
- `increment_notification_retry()`: Function to safely increment retry counts

## TypeScript Type Updates

**Location**: `types.ts`

### New Types Added
```typescript
export type UrgencyLevel = "normal" | "moderate" | "urgent" | "rush";
export type DeliveryStatus = "pending" | "sent" | "delivered" | "failed";
export type ExtensionStatus = "pending" | "approved" | "rejected";
```

### Enhanced Existing Types
- `ProjectStatus`: Added `refund` and `cancelled` statuses
- `Project`: Added `order_reference`, `deadline_charge`, `urgency_level` fields
- `Database`: Added new tables for deadline extensions and notification history

### New Interface Types
```typescript
export interface PricingBreakdown {
  basePrice: number;
  deadlineCharge: number;
  totalPrice: number;
  urgencyLevel: UrgencyLevel;
}

export interface DeadlineExtensionRequestData {
  projectId: number;
  workerId: string;
  requestedDeadline: string;
  reason: string;
}

export interface NotificationData {
  userId: string;
  projectId?: number;
  title: string;
  body: string;
}
```

## Utility Services

### 1. OrderReferenceGenerator
**Location**: `services/orderReferenceGenerator.ts`

**Features:**
- Generates unique order references in format "ORD-YYYY-MM-XXXXXX"
- Validates order reference format
- Parses order reference components
- Handles migration of existing projects
- Thread-safe sequence number generation

**Usage:**
```typescript
import { OrderReferenceGenerator } from './services/orderReferenceGenerator';

const reference = await OrderReferenceGenerator.generate();
const isValid = OrderReferenceGenerator.validate(reference);
const parsed = OrderReferenceGenerator.parse(reference);
```

### 2. PricingCalculator
**Location**: `services/pricingCalculator.ts`

**Features:**
- Calculates base pricing from word count
- Applies deadline-based charges
- Determines urgency levels
- Formats pricing breakdowns for display
- Provides urgency styling information

**Pricing Rules:**
- 1 day deadline: +£30 (rush)
- 2 days deadline: +£10 (urgent)
- 3-6 days deadline: +£5 (moderate)
- 7+ days deadline: No charge (normal)

**Usage:**
```typescript
import { PricingCalculator } from './services/pricingCalculator';

const breakdown = PricingCalculator.calculateTotalPrice(1000, deadline);
const formatted = PricingCalculator.formatPricingBreakdown(breakdown);
```

### 3. NotificationTracker
**Location**: `services/notificationTracker.ts`

**Features:**
- Tracks notification delivery status
- Implements retry logic with exponential backoff
- Stores notification history
- Provides delivery statistics
- Handles failed notification recovery

**Usage:**
```typescript
import { NotificationTracker } from './services/notificationTracker';

const result = await NotificationTracker.trackNotificationDelivery(
  notificationData,
  sendFunction
);
```

## Migration Instructions

### 1. Run Database Migration
```bash
# Using Supabase CLI
supabase db reset

# Or apply migration directly
supabase db push
```

### 2. Initialize Order References
The application automatically initializes order references for existing projects on startup through `App.tsx`.

### 3. Verify Migration
Run the validation script to ensure everything is working:
```bash
npx tsx scripts/validate-schema-updates.ts
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **3.3**: Project status updates for refund/cancelled workflow
- **3.8**: Deadline extension request system
- **7.1**: Order reference number generation
- **7.4**: Order reference storage in database
- **7.7**: Order reference format specification

## Next Steps

1. Run the database migration in your Supabase project
2. Test the order reference generation system
3. Verify pricing calculations work correctly
4. Test notification tracking functionality
5. Proceed to implement the next task in the implementation plan

## Troubleshooting

### Common Issues

1. **Migration Fails**: Ensure you have proper database permissions
2. **Order Reference Generation Fails**: Check database connection and table existence
3. **Type Errors**: Ensure TypeScript compilation is successful with `npm run build`

### Validation

Use the validation script to test all components:
```bash
npx tsx scripts/validate-schema-updates.ts
```

This will verify:
- Order reference generation and validation
- Pricing calculations and urgency levels
- Type definitions and exports
- Database schema compatibility