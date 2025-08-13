# Implementation Plan

- [x] 1. Database Schema Setup and Migration
  - Create new database tables for reference codes, user hierarchy, and agent pricing
  - Add new columns to existing users and projects tables
  - Update user_role enum to include super_agent and super_worker
  - Create database indexes for optimal query performance
  - Write migration scripts to handle existing data
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4_

- [x] 2. Enhanced Type Definitions and Interfaces
  - Update types.ts with new user roles (super_agent, super_worker)
  - Add interfaces for ReferenceCode, UserHierarchy, and AgentPricing
  - Update User interface with hierarchy-related fields
  - Add new permission enums and role-permission mappings
  - Update Project interface with sub_worker_id and sub_agent_id fields
  - _Requirements: 1.1, 1.4, 10.1, 10.2, 10.3_

- [x] 3. Reference Code Management System
  - Implement ReferenceCodeService class with code generation logic
  - Create API endpoints for reference code validation and management
  - Add reference code generation for new Super Agent, Agent, and Super Worker accounts
  - Implement reference code validation during user registration
  - Create database queries for reference code operations
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3_

- [x] 4. User Hierarchy Management System
  - Implement HierarchyService class for managing user relationships
  - Create API endpoints for hierarchy operations and user network queries
  - Add logic to assign users to hierarchy based on reference codes
  - Implement hierarchy validation to prevent circular relationships
  - Create queries to retrieve user networks and hierarchy paths
  - _Requirements: 3.4, 3.5, 4.5, 4.6, 11.5_

- [x] 5. Enhanced Authentication and Registration
  - Update registration process to require and validate reference codes
  - Modify JWT token generation to include hierarchy information
  - Update user session management to track hierarchy relationships
  - Enhance getUserById and related auth functions for hierarchy data
  - Add automatic role assignment based on reference code type
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6. Role-Based Permission System Enhancement
  - Implement enhanced permission checking system with hierarchy awareness
  - Create permission constants and role-permission mappings
  - Add middleware for API endpoint permission validation
  - Implement hierarchical access control (users can access subordinate data)
  - Create utility functions for permission checking in components
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 12.1, 12.2, 12.6, 12.7_

- [x] 7. Super Agent Dashboard Implementation
  - Create SuperAgentDashboard component with full system access
  - Implement project view with profit calculations and assignment details
  - Add Agent database management interface with pricing controls
  - Create interface for setting base prices for sub-agents
  - Implement broadcasting notifications functionality
  - Add complete project status management controls
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 8. Agent Dashboard Updates for Limited Scope
  - Update AgentDashboard to show only assigned clients' projects
  - Add pricing configuration settings tab for word count ranges
  - Implement analytics view showing fees and amounts owed to Super Agent
  - Remove project status modification capabilities for regular agents
  - Update search and filtering to work with limited project scope
  - Ensure pricing calculator uses agent-specific settings
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 9. Super Worker Dashboard Implementation
  - Create SuperWorkerDashboard component for project assignment
  - Implement worker assignment interface with project selection
  - Add notification system for communicating with sub-workers
  - Display standard rate structure (6.25 × 500 words + agent fees)
  - Create interface for managing sub-worker assignments
  - Add project tracking and assignment history
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 10. Worker Dashboard Updates for Assignment View
  - Update WorkerDashboard to show only assigned projects
  - Remove all financial information and profit data from worker view
  - Implement assignment notifications from Super Worker
  - Ensure workers can only see work-related project information
  - Add assignment status and communication features
  - Remove access to financial calculations and pricing data
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 11. Client Dashboard with Agent-Based Pricing
  - Update ClientDashboard to use assigned Agent's pricing structure
  - Implement dynamic pricing calculation based on agent's word count settings
  - Add project number input fields for assignment submissions
  - Update pricing display to reflect agent-specific rates
  - Ensure project submissions are properly assigned to client's agent
  - Add agent-specific pricing breakdown display
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 12. Enhanced Dashboard Router and Navigation
  - Update main Dashboard component to handle 5 user roles
  - Add routing logic for super_agent and super_worker roles
  - Implement role-based navigation menu updates
  - Add proper error handling for unknown or invalid roles
  - Update loading states and role verification
  - Ensure smooth transitions between different dashboard types
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 13. Hierarchical Notification System
  - Update notification service to respect hierarchy relationships
  - Implement Super Agent broadcasting to all users
  - Add Super Worker notifications to assigned sub-workers
  - Create hierarchy-aware notification delivery logic
  - Update notification history tracking for hierarchy context
  - Add notification preferences based on user role and hierarchy
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [x] 14. Financial Data Security and Access Control
  - Implement strict financial data filtering based on user roles
  - Remove financial information access for Worker role
  - Add agent-specific financial data filtering
  - Implement Super Agent full financial data access
  - Add Super Worker financial data for project assignments
  - Create client pricing visibility controls
  - Add audit logging for financial data access attempts
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 15. Agent Pricing Configuration System
  - Create AgentPricing model and database operations
  - Implement pricing configuration interface for agents
  - Add Super Agent controls for setting agent base prices
  - Create dynamic pricing calculator using agent-specific rates
  - Implement pricing validation and range checking
  - Add pricing history and change tracking
  - _Requirements: 5.4, 6.3, 6.7, 6.8, 9.2, 9.4, 9.6_

- [x] 16. Project Assignment Enhancement
  - Update project creation to include sub_worker_id and sub_agent_id fields
  - Implement project assignment logic for hierarchy levels
  - Add project_numbers field support for multiple project references
  - Update project queries to include hierarchy information
  - Create assignment tracking and history functionality
  - Add validation for proper hierarchy-based assignments
  - _Requirements: 4.1, 4.2, 7.2, 7.4, 7.5, 9.1, 9.5_

- [x] 17. API Endpoints for Hierarchy Operations
  - Create REST endpoints for reference code management
  - Add API endpoints for user hierarchy operations
  - Implement hierarchy-aware project and user queries
  - Add endpoints for agent pricing configuration
  - Create notification endpoints with hierarchy support
  - Add proper error handling and validation for all endpoints
  - _Requirements: 2.6, 3.6, 4.5, 4.6, 5.6, 6.4, 7.3, 8.4, 11.4_

- [x] 18. Testing and Validation
  - Write unit tests for reference code generation and validation
  - Create integration tests for hierarchy assignment logic
  - Add tests for role-based permission checking
  - Test dashboard components for each user role
  - Validate financial data security and access controls
  - Test notification system with hierarchy relationships
  - Add end-to-end tests for registration and dashboard flows
  - _Requirements: All requirements validation and system integrity_

- [x] 19. Error Handling and User Experience
  - Implement comprehensive error handling for hierarchy operations
  - Add user-friendly error messages for reference code validation
  - Create graceful degradation for permission-denied scenarios
  - Add loading states for hierarchy-related operations
  - Implement proper error boundaries for new dashboard components
  - Add validation feedback for all hierarchy-related forms
  - _Requirements: 3.6, 10.6, 10.7, 12.7_

- [x] 20. Documentation and Migration Support
  - Create database migration scripts for production deployment
  - Add API documentation for new hierarchy endpoints
  - Create user guides for each role's dashboard functionality
  - Document reference code distribution and management process
  - Add troubleshooting guide for hierarchy-related issues
  - Create deployment checklist for hierarchy system rollout
  - _Requirements: System deployment and user adoption support_