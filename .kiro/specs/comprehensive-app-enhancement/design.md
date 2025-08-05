# Design Document

## Overview

This design document outlines the comprehensive enhancement of the existing project management application. The system currently supports three user roles (client, worker, agent) with basic project management functionality. The enhancements will focus on fixing the notification system, adding advanced filtering and analytics capabilities, implementing new project statuses, enhancing the pricing system, and improving the overall user experience.

## Architecture

### Current Architecture
The application follows a React-based frontend architecture with:
- **Frontend**: React with TypeScript, Vite build system
- **Backend**: Supabase (PostgreSQL database, Edge Functions, Storage)
- **Authentication**: Supabase Auth
- **Notifications**: Push notifications via service workers and VAPID keys
- **File Storage**: Supabase Storage with bucket-based organization

### Enhanced Architecture Components

#### 1. Notification System Enhancement
- **Real-time Reliability**: Implement retry mechanisms with exponential backoff
- **Database Tracking**: Store notification history and delivery status
- **Event-driven Triggers**: Automatic notifications on all status changes
- **Error Handling**: Comprehensive error handling with fallback mechanisms

#### 2. Dashboard Filtering System
- **Time-based Filters**: Week, month, and custom date range filtering
- **Real-time Calculations**: Dynamic earnings and profit calculations
- **Currency Conversion**: Live GBP to INR conversion display
- **Performance Optimization**: Efficient database queries with proper indexing

#### 3. Analytics Dashboard
- **Chart Integration**: Monthly analytics with interactive charts
- **Business Metrics**: Client numbers, project counts, revenue tracking
- **Profit Analysis**: Agent profit vs worker payment calculations
- **Data Visualization**: Clean, responsive chart components

## Components and Interfaces

### 1. Enhanced Notification System

#### NotificationService Interface
```typescript
interface NotificationService {
  sendNotification(target: NotificationTarget, payload: NotificationPayload): Promise<NotificationResult>
  retryFailedNotifications(): Promise<void>
  trackNotificationDelivery(notificationId: string, status: DeliveryStatus): Promise<void>
}

interface NotificationResult {
  success: boolean
  notificationId: string
  deliveryStatus: DeliveryStatus
  error?: string
}

interface DeliveryStatus {
  sent: boolean
  delivered: boolean
  failed: boolean
  retryCount: number
  lastAttempt: Date
}
```

#### Database Schema Updates
```sql
-- New table for notification tracking
CREATE TABLE notification_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  delivery_status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  error_message TEXT
);
```

### 2. Enhanced Dashboard Components

#### FilterBar Component
```typescript
interface FilterBarProps {
  onFilterChange: (filter: TimeFilter) => void
  onDateRangeChange: (startDate: Date, endDate: Date) => void
  currentFilter: TimeFilter
  earnings?: EarningsDisplay
}

interface TimeFilter {
  type: 'week' | 'month' | 'custom'
  startDate?: Date
  endDate?: Date
}

interface EarningsDisplay {
  gbp: number
  inr: number
  profit?: number
  toPay?: number
}
```

#### Analytics Dashboard Component
```typescript
interface AnalyticsDashboardProps {
  timeRange: TimeFilter
  data: AnalyticsData
}

interface AnalyticsData {
  clientCount: number
  projectCount: number
  averagePrice: number
  totalRevenue: number
  totalProfit: number
  totalToPay: number
  monthlyData: MonthlyMetrics[]
}

interface MonthlyMetrics {
  month: string
  clients: number
  projects: number
  revenue: number
  profit: number
}
```

### 3. Enhanced Project Management

#### Project Status Updates
```typescript
type ProjectStatus = 
  | "pending_payment_approval"
  | "rejected_payment"
  | "awaiting_worker_assignment"
  | "in_progress"
  | "pending_quote_approval"
  | "needs_changes"
  | "pending_final_approval"
  | "completed"
  | "refund"      // New status
  | "cancelled"   // New status

interface ProjectActions {
  cancelProject: (projectId: number, reason: string) => Promise<void>
  requestDeadlineExtension: (projectId: number, newDeadline: Date, reason: string) => Promise<void>
  processRefund: (projectId: number) => Promise<void>
}
```

#### Order Reference System
```typescript
interface OrderReference {
  generate(): string
  validate(reference: string): boolean
  format: string // "ORD-YYYY-MM-XXXXXX" format
}

// Database schema update
ALTER TABLE projects ADD COLUMN order_reference VARCHAR(20) UNIQUE NOT NULL;
```

### 4. Enhanced Pricing System

#### Deadline-based Pricing
```typescript
interface PricingCalculator {
  calculateBasePrice(wordCount: number): number
  calculateDeadlineCharge(deadline: Date, requestDate: Date): number
  calculateTotalPrice(wordCount: number, deadline: Date): PricingBreakdown
}

interface PricingBreakdown {
  basePrice: number
  deadlineCharge: number
  totalPrice: number
  urgencyLevel: 'normal' | 'moderate' | 'urgent' | 'rush'
}

interface DeadlinePricing {
  daysFromRequest: number
  additionalCharge: number
  urgencyLevel: string
}

const DEADLINE_PRICING: DeadlinePricing[] = [
  { daysFromRequest: 1, additionalCharge: 30, urgencyLevel: 'rush' },
  { daysFromRequest: 2, additionalCharge: 10, urgencyLevel: 'urgent' },
  { daysFromRequest: 3, additionalCharge: 5, urgencyLevel: 'moderate' },
  { daysFromRequest: 6, additionalCharge: 5, urgencyLevel: 'moderate' },
  { daysFromRequest: 7, additionalCharge: 0, urgencyLevel: 'normal' }
]
```

## Data Models

### Enhanced Project Model
```typescript
interface EnhancedProject extends Project {
  order_reference: string
  deadline_charge: number
  urgency_level: string
  cancellation_reason?: string
  deadline_extension_requests: DeadlineExtensionRequest[]
}

interface DeadlineExtensionRequest {
  id: number
  project_id: number
  worker_id: string
  requested_deadline: Date
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: Date
}
```

### Analytics Data Model
```typescript
interface ProjectAnalytics {
  timeRange: TimeFilter
  totalProjects: number
  totalRevenue: number
  totalProfit: number
  totalWorkerPayments: number
  averageProjectValue: number
  clientCount: number
  monthlyBreakdown: MonthlyAnalytics[]
}

interface MonthlyAnalytics {
  month: string
  year: number
  projectCount: number
  revenue: number
  profit: number
  newClients: number
  completedProjects: number
}
```

### Notification Tracking Model
```typescript
interface NotificationRecord {
  id: number
  user_id: string
  title: string
  body: string
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed'
  retry_count: number
  created_at: Date
  delivered_at?: Date
  error_message?: string
  project_id?: number
}
```

## Error Handling

### Notification System Error Handling
1. **Connection Failures**: Implement retry logic with exponential backoff
2. **VAPID Key Issues**: Clear error messages and configuration validation
3. **Permission Denied**: Graceful degradation with alternative notification methods
4. **Service Worker Failures**: Automatic re-registration and fallback mechanisms

### Dashboard Error Handling
1. **Data Loading Failures**: Show error states with retry options
2. **Filter Calculation Errors**: Fallback to default calculations
3. **Currency Conversion Failures**: Use cached rates with warning indicators
4. **Chart Rendering Errors**: Fallback to table view with error logging

### Project Management Error Handling
1. **Status Update Failures**: Rollback UI changes and show error messages
2. **File Upload Failures**: Retry mechanisms with progress indicators
3. **Database Constraint Violations**: User-friendly error messages
4. **Concurrent Modification**: Optimistic locking with conflict resolution

## Testing Strategy

### Unit Testing
- **Notification Service**: Test retry logic, error handling, and delivery tracking
- **Pricing Calculator**: Test all deadline scenarios and edge cases
- **Filter Components**: Test date range calculations and currency conversions
- **Analytics Calculations**: Test data aggregation and chart data preparation

### Integration Testing
- **Dashboard Filtering**: Test end-to-end filtering with real data
- **Notification Flow**: Test complete notification lifecycle
- **Project Status Changes**: Test status transitions and notifications
- **File Upload Process**: Test complete file handling workflow

### User Experience Testing
- **Loading States**: Test all loading scenarios and timeout handling
- **Animation Performance**: Test smooth transitions and responsiveness
- **Mobile Responsiveness**: Test all components on various screen sizes
- **Accessibility**: Test keyboard navigation and screen reader compatibility

### Performance Testing
- **Database Query Optimization**: Test query performance with large datasets
- **Real-time Updates**: Test notification delivery speed and reliability
- **Chart Rendering**: Test chart performance with large datasets
- **Memory Usage**: Test for memory leaks in long-running sessions

## UI/UX Design Enhancements

### Modal Improvements
- **Enhanced Visual Hierarchy**: Better spacing, typography, and color usage
- **Smooth Animations**: Entrance/exit animations with proper timing
- **Improved Accessibility**: Better focus management and keyboard navigation
- **Responsive Design**: Optimized layouts for all screen sizes

### Form Enhancements
- **Better Validation**: Real-time validation with clear error messages
- **Improved Date Pickers**: More intuitive date selection with better UX
- **Enhanced Dropdowns**: Better styling with search functionality
- **Loading States**: Smooth loading indicators without blocking UI

### Animation System
- **Page Transitions**: Smooth transitions between dashboard views
- **Micro-interactions**: Subtle animations for buttons and form elements
- **Loading Animations**: Improved loading states with proper timeout handling
- **Error Animations**: Gentle animations for error states and recovery

### Design System Updates
- **Color Palette**: Enhanced color scheme with better contrast ratios
- **Typography**: Improved font hierarchy and readability
- **Spacing System**: Consistent spacing using design tokens
- **Component Library**: Standardized components with variants and states