# Implementation Plan

- [x] 1. Database Schema Updates and Order Reference System
  - Update Supabase database schema to add new project statuses ('refund', 'cancelled')
  - Add order_reference column to projects table with unique constraint
  - Add deadline_charge and urgency_level columns to projects table
  - Create deadline_extension_requests table for worker deadline requests
  - Create notification_history table for tracking notification delivery
  - Implement order reference generator utility with format "ORD-YYYY-MM-XXXXXX"
  - _Requirements: 3.3, 3.8, 7.1, 7.4, 7.7_

- [x] 2. Enhanced Notification System Core
  - [x] 2.1 Implement notification tracking and retry mechanism
    - Create NotificationTracker class with database logging functionality
    - Implement exponential backoff retry logic for failed notifications
    - Add notification delivery status tracking in database
    - Create notification history management functions
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 2.2 Fix notification service reliability
    - Update sendNotification function with 100% delivery guarantee
    - Implement proper error handling with user-friendly messages
    - Add notification queue system for handling high volume
    - Create notification status monitoring dashboard component
    - _Requirements: 1.1, 1.2, 1.4, 1.6_

- [x] 3. Enhanced Pricing System with Deadline Charges
  - [x] 3.1 Implement deadline-based pricing calculator
    - Create PricingCalculator class with deadline charge logic
    - Implement calculateDeadlineCharge function based on days from request
    - Add pricing breakdown display component showing base price + deadline charge
    - Update calculatePrice function to include deadline charges
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 3.2 Update new assignment form with enhanced pricing
    - Modify ClientForm component to show pricing breakdown
    - Add real-time price calculation as user selects deadline
    - Display urgency level indicator based on selected deadline
    - Update form submission to include deadline charges in database
    - _Requirements: 8.1, 8.6, 8.7_

- [x] 4. Dashboard Filtering System Implementation
  - [x] 4.1 Create FilterBar component for time-based filtering
    - Implement FilterBar component with week/month/custom date range options
    - Create DateRangePicker component with improved UX
    - Add filter state management with URL persistence
    - Implement filter validation and error handling
    - _Requirements: 2.1, 2.2, 2.6_

  - [x] 4.2 Implement earnings calculation system
    - Create EarningsCalculator utility for worker dashboard
    - Implement currency conversion display (GBP to INR format)
    - Add real-time earnings calculation based on filtered projects
    - Create ProfitCalculator utility for agent dashboard
    - _Requirements: 2.3, 2.4, 2.5, 2.7, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 5. Worker Dashboard Enhancements
  - [x] 5.1 Add filtering and earnings display to worker dashboard
    - Integrate FilterBar component into WorkerDashboard
    - Add earnings display field showing filtered period calculations
    - Implement project filtering logic based on selected time range
    - Add loading states for earnings calculations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 5.2 Implement project cancellation functionality
    - Add 'Cancel Project' button to project modals with danger zone styling
    - Create confirmation popup with "Are you sure?" message
    - Implement cancelProject function to set status to 'refund'
    - Add notification to agent when project is cancelled
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.3 Add deadline extension request feature
    - Create 'Request Deadline' form component in worker dashboard
    - Implement requestDeadlineExtension function with database storage
    - Add notification system for deadline extension requests
    - Create deadline extension management in agent dashboard
    - _Requirements: 3.6, 3.7, 3.8_

- [x] 6. Agent Dashboard Enhancements
  - [x] 6.1 Add filtering and profit tracking to agent dashboard
    - Integrate FilterBar component into AgentDashboard
    - Add profit display field showing 'Profit £X / To Give £Y' format
    - Implement profit calculation logic based on filtered time periods
    - Add worker payment tracking and calculations
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 6.2 Implement advanced project filtering and search
    - Add client ID and module name filter dropdowns
    - Create search field for order reference number filtering
    - Add copy icon next to client ID in project modals
    - Implement real-time filtering with multiple criteria
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 6.3 Create analytics dashboard view
    - Implement view toggle between 'charts' and 'docs' modes
    - Create AnalyticsDashboard component with monthly charts
    - Add chart components for client numbers, project numbers, revenue, profit
    - Implement analytics data calculation and aggregation functions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 7. Project Status System Updates
  - [x] 7.1 Update project status handling for new statuses
    - Update ProjectStatus type to include 'refund' and 'cancelled'
    - Modify status badge component to handle new statuses
    - Update all status transition logic throughout the application
    - Add status validation and business rule enforcement
    - _Requirements: 3.4, 3.5_

  - [x] 7.2 Implement refund processing workflow
    - Create processRefund function for agent dashboard
    - Add refund processing UI in agent dashboard
    - Implement automatic status change from 'refund' to 'cancelled'
    - Add refund tracking and notification system
    - _Requirements: 3.4, 3.5_

- [x] 8. Order Reference System Integration
  - [x] 8.1 Implement order reference generation and display
    - Create OrderReferenceGenerator utility class
    - Update project creation to automatically generate order references
    - Add order reference display to all project modals (client/worker/agent)
    - Implement order reference validation and uniqueness checking
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 8.2 Update search functionality for order references
    - Modify search components to support order reference searching
    - Add order reference to project listing displays
    - Update database queries to include order reference filtering
    - Implement order reference formatting and display consistency
    - _Requirements: 5.4, 7.5, 7.6_

- [x] 9. UI/UX Design Improvements
  - [x] 9.1 Enhance modal and popup designs
    - Update modal components with improved visual hierarchy
    - Add smooth entrance and exit animations to modals
    - Improve modal responsiveness and accessibility
    - Enhance confirmation popups with better styling
    - _Requirements: 9.1, 9.2, 9.5, 9.6_

  - [x] 9.2 Improve form components and interactions
    - Enhance dropdown components with better styling and search
    - Update date picker component with improved UX
    - Add real-time validation with smooth error displays
    - Implement better loading states for form submissions
    - _Requirements: 9.2, 9.3, 9.4_

  - [x] 9.3 Implement smooth animations and transitions
    - Add page transition animations between dashboard views
    - Create micro-interactions for buttons and form elements
    - Implement smooth loading animations with proper timeout handling
    - Add gentle error state animations and recovery flows
    - _Requirements: 9.4, 9.5, 9.7, 9.8, 9.9_

- [x] 10. Loading State and Performance Improvements
  - [x] 10.1 Fix loading state issues and improve performance
    - Update loading components to prevent getting stuck
    - Add proper timeout handling for all loading states
    - Implement smooth loading transitions without blocking UI
    - Add error recovery mechanisms for failed loading states
    - _Requirements: 9.7, 9.8_

  - [x] 10.2 Optimize database queries and caching
    - Implement efficient filtering queries for dashboard data
    - Add caching for frequently accessed data (exchange rates, analytics)
    - Optimize project listing queries with proper indexing
    - Implement pagination for large project lists
    - _Requirements: 2.6, 4.7, 6.7_

- [x] 11. Integration Testing and Notification System Validation
  - [x] 11.1 Test notification system reliability
    - Create comprehensive tests for notification delivery
    - Test retry mechanisms and error handling
    - Validate notification tracking and history functionality
    - Test notification system with all project status changes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 11.2 Test dashboard filtering and calculations
    - Test earnings calculations with various time filters
    - Validate currency conversion accuracy and display
    - Test profit calculations for agent dashboard
    - Verify analytics data accuracy and chart rendering
    - _Requirements: 2.3, 2.4, 2.5, 2.7, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.3, 6.6, 6.7_

- [x] 12. Final Integration and Polish
  - [x] 12.1 Complete end-to-end testing and bug fixes
    - Test complete project lifecycle with new features
    - Validate all notification triggers and deliveries
    - Test all dashboard filtering and calculation features
    - Verify order reference system functionality
    - _Requirements: All requirements validation_

  - [x] 12.2 Final UI polish and performance optimization
    - Apply final design improvements and consistency checks
    - Optimize animation performance and smoothness
    - Test responsive design across all screen sizes
    - Implement final accessibility improvements
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_