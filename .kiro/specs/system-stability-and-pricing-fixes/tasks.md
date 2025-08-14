# Implementation Plan

- [x] 1. Fix Critical API Errors and System Stability
  - Fix all 500/403/404 errors across notification, hierarchy, and user endpoints
  - Implement centralized error handling middleware with consistent responses
  - Debug and repair database queries causing notification system failures
  - Add proper role-based permission validation for all protected routes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Implement Complete Pricing Calculation System
  - Create Super Agent pricing table with fixed rates (£45 for 500 words to £440 for 20,000 words)
  - Update existing Agent pricing service to work with assignment creation
  - Implement urgency-based pricing (£30 next day, £10 for 2-3 days, £5 for 4-7 days)
  - Integrate pricing determination logic to choose Super Agent vs Agent pricing based on client hierarchy
  - Fix assignment creation flow to calculate and display pricing before submission
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Create Role-Based Analytics and Earnings System
  - Implement Super Worker earnings calculator (£6.25 per 500 words) with GBP to INR conversion
  - Create Super Agent analytics showing revenue minus Super Worker fees minus Agent fees
  - Build Agent analytics displaying earnings minus Super Agent fees (including Super Worker costs)
  - Add database tracking for all earnings, fees, and profit calculations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. Database Schema Updates and Data Migration
  - Create Super Agent pricing table and populate with specified pricing tiers
  - Add pricing tracking columns to projects table (pricing_type, base_price_gbp, urgency_charge_gbp, etc.)
  - Create user_earnings table for analytics tracking
  - Update existing constants.ts with Super Agent pricing table
  - Create database indexes for optimal pricing and analytics query performance
  - _Requirements: All data model requirements_

- [x] 5. Integration Testing and System Validation
  - Test complete assignment creation flow with pricing calculations for all user roles
  - Validate analytics calculations for Super Agent, Agent, and Super Worker roles
  - Test currency conversion accuracy for Super Worker earnings
  - Verify all API endpoints return proper responses without errors
  - Test role-based access control and hierarchy permissions
  - _Requirements: All requirements validation_