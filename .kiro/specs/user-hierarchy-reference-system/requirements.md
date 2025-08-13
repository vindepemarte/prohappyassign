# Requirements Document

## Introduction

This feature implements a comprehensive user hierarchy system with reference code-based recruitment and role-based permissions. The system supports 5 distinct user roles (Super Agent, Agent, Client, Super Worker, Worker) with hierarchical relationships, reference code assignment for user recruitment, and role-specific dashboard functionality with appropriate permission controls.

## Requirements

### Requirement 1: User Role Hierarchy System

**User Story:** As a system administrator, I want a hierarchical user role structure with 5 distinct roles, so that I can manage different levels of users with appropriate permissions and relationships.

#### Acceptance Criteria

1. WHEN the system is configured THEN it SHALL support exactly 5 user roles: Super Agent, Agent, Client, Super Worker, and Worker
2. WHEN users are created THEN they SHALL be assigned to one of these 5 roles
3. WHEN role hierarchy is established THEN Super Agent SHALL be at the top level with full system access
4. WHEN role relationships are defined THEN Agents SHALL be sub-users under Super Agents
5. WHEN role relationships are defined THEN Workers SHALL be sub-users under Super Workers
6. WHEN role relationships are defined THEN Clients SHALL be assigned to Agents or Super Agents
7. WHEN user roles are assigned THEN the system SHALL enforce hierarchical relationships in all operations

### Requirement 2: Reference Code Assignment System

**User Story:** As a Super Agent, Agent, or Super Worker, I want to have reference codes for recruiting users, so that I can build my network and track user assignments.

#### Acceptance Criteria

1. WHEN a Super Agent account is created THEN the system SHALL generate 2 unique reference codes
2. WHEN Super Agent reference codes are generated THEN one SHALL be for recruiting Agents and one SHALL be for recruiting Clients
3. WHEN an Agent account is created THEN the system SHALL generate 1 unique reference code for recruiting Clients
4. WHEN a Super Worker account is created THEN the system SHALL generate 1 unique reference code for recruiting Workers
5. WHEN reference codes are generated THEN they SHALL be unique across the entire system
6. WHEN reference codes are created THEN they SHALL be stored in the database with owner identification
7. WHEN reference codes are displayed THEN users SHALL be able to view and share their codes

### Requirement 3: Registration with Reference Code Validation

**User Story:** As a new user registering for the system, I want to enter a reference code during registration, so that I can be automatically assigned to the appropriate network hierarchy.

#### Acceptance Criteria

1. WHEN a user registers THEN the system SHALL require a reference code as a mandatory field
2. WHEN a reference code is entered THEN the system SHALL validate it exists in the database
3. WHEN reference code validation occurs THEN the system SHALL identify the code owner (Super Agent/Agent/Super Worker)
4. WHEN a valid reference code is provided THEN the user SHALL be automatically assigned to the code owner's network
5. WHEN user assignment occurs THEN all relationships SHALL ultimately roll up to the Super Agent level
6. WHEN an invalid reference code is entered THEN the system SHALL display an error message and prevent registration
7. WHEN registration is completed THEN the user SHALL be granted appropriate permissions based on their assigned role

### Requirement 4: Database Schema Updates for Hierarchy

**User Story:** As a system developer, I want updated database schemas to support the user hierarchy and reference tracking, so that all relationships and assignments are properly stored.

#### Acceptance Criteria

1. WHEN the projects table is updated THEN it SHALL include sub-worker-id and sub-agent-id fields
2. WHEN the assignments table is updated THEN it SHALL include a project_numbers text field for multiple project references
3. WHEN reference codes are stored THEN the system SHALL track which user owns each reference code
4. WHEN user relationships are stored THEN the system SHALL maintain assignment relationships between users and their recruiters
5. WHEN database queries occur THEN the system SHALL efficiently retrieve hierarchical relationships
6. WHEN data integrity is maintained THEN all foreign key relationships SHALL be properly enforced
7. WHEN schema updates are applied THEN existing data SHALL be preserved and migrated appropriately

### Requirement 5: Super Agent Dashboard with Full Control

**User Story:** As a Super Agent, I want comprehensive dashboard functionality with full system control, so that I can manage all projects, users, and financial aspects of the system.

#### Acceptance Criteria

1. WHEN I access my dashboard THEN the system SHALL display all projects with profit calculations
2. WHEN I view projects THEN the system SHALL show profit margins and assignment details
3. WHEN I manage agents THEN the system SHALL provide an Agent database with pricing controls
4. WHEN I set pricing THEN the system SHALL allow me to set base prices for each sub-agent including 500-word rate and fees
5. WHEN I view financial data THEN the system SHALL display "to be paid" amounts split between Super Worker and Agent fees
6. WHEN I need to communicate THEN the system SHALL allow broadcasting notifications to all users
7. WHEN I manage projects THEN the system SHALL allow complete project status management
8. WHEN I view assignments THEN the system SHALL show which agent or sub-agent is assigned to each project

### Requirement 6: Agent Dashboard with Limited Scope

**User Story:** As an Agent, I want a dashboard that shows only my assigned clients' projects with pricing configuration capabilities, so that I can manage my specific client base effectively.

#### Acceptance Criteria

1. WHEN I access my dashboard THEN the system SHALL display only projects from my assigned clients
2. WHEN I view projects THEN the system SHALL NOT show projects from other agents' clients
3. WHEN I access settings THEN the system SHALL provide a pricing configuration tab for 500-20,000 words
4. WHEN I view analytics THEN the system SHALL show fees and amounts owed to Super Agent
5. WHEN I search projects THEN the system SHALL allow filtering by order reference and client name
6. WHEN I attempt to modify project status THEN the system SHALL prevent me from making changes
7. WHEN clients view pricing THEN it SHALL be based on my word count settings
8. WHEN pricing calculator is used THEN it SHALL update dynamically based on project word count

### Requirement 7: Super Worker Dashboard with Assignment Control

**User Story:** As a Super Worker, I want to assign projects to sub-workers and manage their assignments, so that I can distribute workload effectively while maintaining standard rates.

#### Acceptance Criteria

1. WHEN I access my dashboard THEN the system SHALL allow me to assign projects to sub-workers
2. WHEN I view rates THEN the system SHALL maintain standard rate of 6.25 × 500 words plus agent referral fees
3. WHEN I assign projects THEN the system SHALL send notifications to assigned sub-workers
4. WHEN I manage assignments THEN the system SHALL track which sub-worker is assigned to each project
5. WHEN I view projects THEN the system SHALL show all projects available for assignment
6. WHEN I communicate with sub-workers THEN the system SHALL allow sending assignment notifications
7. WHEN financial calculations occur THEN the system SHALL use the standard rate structure

### Requirement 8: Worker Dashboard with Assignment View

**User Story:** As a Worker, I want to view only my assigned projects without financial information, so that I can focus on completing my assigned work.

#### Acceptance Criteria

1. WHEN I access my dashboard THEN the system SHALL display only projects assigned to me
2. WHEN I view projects THEN the system SHALL NOT display any financial information or profit data
3. WHEN I view projects THEN the system SHALL NOT show projects assigned to other workers
4. WHEN I receive assignments THEN the system SHALL send me notifications from my Super Worker
5. WHEN I view project details THEN the system SHALL show only work-related information
6. WHEN I attempt to access financial data THEN the system SHALL prevent access
7. WHEN notifications are sent THEN I SHALL receive them for my assigned projects only

### Requirement 9: Client Dashboard with Agent-Based Pricing

**User Story:** As a Client, I want to submit assignments and see pricing based on my assigned Agent's rate structure, so that I can understand costs and track my project submissions.

#### Acceptance Criteria

1. WHEN I submit new assignments THEN the system SHALL allow me to include project numbers
2. WHEN I view pricing THEN it SHALL be based on my assigned Agent's rate structure
3. WHEN I see project status THEN the system SHALL show current status and updates
4. WHEN pricing is calculated THEN it SHALL be automatically calculated by word count
5. WHEN I view my projects THEN the system SHALL show only my submitted projects
6. WHEN I interact with the system THEN pricing SHALL update dynamically based on word count
7. WHEN I submit projects THEN they SHALL be properly assigned to my Agent

### Requirement 10: Role-Based Permission System

**User Story:** As a system user, I want permissions that match my role level, so that I can access appropriate functionality while being restricted from unauthorized actions.

#### Acceptance Criteria

1. WHEN I am a Super Agent THEN I SHALL have permission to change project status, set pricing, view all projects, send notifications, and view all financial data
2. WHEN I am an Agent THEN I SHALL have permission to set my own rates and view my own fees, but NOT change project status or view all projects
3. WHEN I am a Client THEN I SHALL have permission to view pricing and my own projects, but NOT access administrative functions
4. WHEN I am a Super Worker THEN I SHALL have permission to assign workers, view all projects, send notifications to sub-workers, and view financial data
5. WHEN I am a Worker THEN I SHALL have permission to view only assigned projects with NO access to financial data
6. WHEN I attempt unauthorized actions THEN the system SHALL prevent access and display appropriate error messages
7. WHEN permissions are enforced THEN they SHALL be consistent across all dashboard views and API endpoints

### Requirement 11: Notification System for Hierarchy

**User Story:** As a user in the hierarchy system, I want to receive appropriate notifications based on my role and relationships, so that I stay informed about relevant activities.

#### Acceptance Criteria

1. WHEN I am a Super Agent THEN I SHALL be able to broadcast notifications to all users in the system
2. WHEN I am a Super Worker THEN I SHALL be able to send notifications to my assigned sub-workers
3. WHEN project assignments are made THEN relevant users SHALL receive automatic notifications
4. WHEN project status changes occur THEN notifications SHALL be sent to appropriate hierarchy levels
5. WHEN notifications are sent THEN they SHALL respect the hierarchical relationships
6. WHEN I receive notifications THEN they SHALL be relevant to my role and assigned projects
7. WHEN notification delivery occurs THEN it SHALL be reliable and trackable

### Requirement 12: Financial Data Security and Visibility

**User Story:** As a system user, I want financial information to be visible only to authorized roles, so that sensitive financial data is protected while allowing appropriate access for business operations.

#### Acceptance Criteria

1. WHEN I am a Worker THEN I SHALL NOT be able to see any financial information including profit, pricing, or payment data
2. WHEN I am an Agent THEN I SHALL see only my own client projects and fee structures
3. WHEN I am a Super Agent THEN I SHALL see all financial data including profit calculations and payment distributions
4. WHEN I am a Super Worker THEN I SHALL see financial data related to project assignments and worker payments
5. WHEN I am a Client THEN I SHALL see pricing information relevant to my projects
6. WHEN financial data is displayed THEN it SHALL be filtered based on user role and permissions
7. WHEN unauthorized access is attempted THEN the system SHALL prevent access and log the attempt