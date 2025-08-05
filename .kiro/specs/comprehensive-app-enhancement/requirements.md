# Requirements Document

## Introduction

This feature encompasses a comprehensive enhancement of the existing project management application, focusing on fixing the notification system, improving dashboard functionality across all user roles (client, worker, agent), implementing advanced filtering and analytics, updating the project system with order reference numbers, enhancing pricing calculations with deadline-based charges, and improving the overall user interface design and user experience.

## Requirements

### Requirement 1: Notification System Fix

**User Story:** As any user of the system, I want a reliable notification system that works consistently, so that I can stay informed about project updates and status changes in real-time.

#### Acceptance Criteria

1. WHEN any project status changes THEN the system SHALL send notifications to all relevant users
2. WHEN a notification is triggered THEN the system SHALL ensure 100% delivery reliability
3. WHEN notifications are sent THEN they SHALL be stored in the database for tracking
4. WHEN users receive notifications THEN they SHALL be able to view them in real-time
5. IF notification delivery fails THEN the system SHALL retry with exponential backoff
6. WHEN database changes occur THEN the notification system SHALL reflect these changes immediately

### Requirement 2: Worker Dashboard Filtering and Earnings

**User Story:** As a worker, I want to filter my projects by time periods and see my earnings calculations, so that I can track my income and manage my workload effectively.

#### Acceptance Criteria

1. WHEN I access the worker dashboard THEN the system SHALL display filter buttons for 'week', 'monthly', and date picker range
2. WHEN I select a time filter THEN the system SHALL show projects only from that period
3. WHEN projects are filtered THEN the system SHALL display earnings in format '£50 / 5826.90 Indian Rupee'
4. WHEN I select 'week' filter THEN the system SHALL calculate earnings from all projects in that week
5. WHEN I select 'monthly' filter THEN the system SHALL calculate earnings from all projects in that month
6. WHEN I use date picker range THEN the system SHALL calculate earnings from projects within the selected date range
7. WHEN earnings are calculated THEN the system SHALL use real-time exchange rates for currency conversion

### Requirement 3: Worker Project Management Actions

**User Story:** As a worker, I want to cancel projects and request deadline extensions, so that I can manage my workload and handle situations where I cannot meet original deadlines.

#### Acceptance Criteria

1. WHEN I view a project modal THEN the system SHALL display a 'cancel project' button in a danger zone
2. WHEN I click 'cancel project' THEN the system SHALL show a confirmation popup asking 'are you sure?'
3. WHEN I confirm project cancellation THEN the system SHALL set project status to 'refund'
4. WHEN project status is 'refund' THEN the agent SHALL be notified to process the refund
5. WHEN refund is processed THEN the system SHALL set project status to 'cancelled'
6. WHEN I need more time THEN the system SHALL provide a 'request deadline' option
7. WHEN I request deadline extension THEN the system SHALL notify the client and agent
8. WHEN deadline request is made THEN the system SHALL store the request with timestamp and reason

### Requirement 4: Agent Dashboard Filtering and Profit Tracking

**User Story:** As an agent, I want to filter projects by time periods and see profit calculations, so that I can track my earnings and amounts owed to workers.

#### Acceptance Criteria

1. WHEN I access the agent dashboard THEN the system SHALL display the same time filters as worker dashboard
2. WHEN I select a time filter THEN the system SHALL show profit calculations in format 'Profit £77.50 / To Give £62.50'
3. WHEN I select 'week' filter THEN the system SHALL calculate profit and worker payments for that week
4. WHEN I select 'monthly' filter THEN the system SHALL calculate profit and worker payments for that month
5. WHEN I use date picker range THEN the system SHALL calculate profit and worker payments for the selected period
6. WHEN profit is calculated THEN the system SHALL show my earnings minus worker payments
7. WHEN 'To Give' amount is calculated THEN the system SHALL show total amount owed to workers

### Requirement 5: Agent Project Filtering and Search

**User Story:** As an agent, I want advanced filtering and search capabilities for projects, so that I can quickly find and manage specific projects and clients.

#### Acceptance Criteria

1. WHEN I access the projects section THEN the system SHALL display filters for 'client id' and 'module name'
2. WHEN I view project modals THEN the system SHALL display a 'copy' icon next to client id
3. WHEN I click the copy icon THEN the system SHALL copy the client id to clipboard
4. WHEN I need to search THEN the system SHALL provide a search field for order reference numbers
5. WHEN I enter search terms THEN the system SHALL filter projects matching the order reference number
6. WHEN I use multiple filters THEN the system SHALL apply all filters simultaneously
7. WHEN filters are applied THEN the system SHALL update the project list in real-time

### Requirement 6: Agent Analytics Dashboard

**User Story:** As an agent, I want access to analytics and charts, so that I can analyze business performance and make data-driven decisions.

#### Acceptance Criteria

1. WHEN I access the agent dashboard THEN the system SHALL display a 'charts' icon
2. WHEN I click the 'charts' icon THEN the system SHALL switch to analytics view
3. WHEN in analytics view THEN the system SHALL display monthly charts for client numbers, project numbers, average price per project, total revenue, total profit, and total to be paid
4. WHEN I want to return to projects THEN the system SHALL display a 'docs' icon
5. WHEN I click the 'docs' icon THEN the system SHALL return to the normal project view
6. WHEN charts are displayed THEN they SHALL be interactive and show monthly data
7. WHEN analytics are calculated THEN they SHALL reflect real-time data from the database

### Requirement 7: Order Reference Number System

**User Story:** As any user, I want projects to have unique order reference numbers, so that I can easily identify and track specific projects.

#### Acceptance Criteria

1. WHEN a new project is created THEN the system SHALL automatically generate a unique order reference number
2. WHEN order reference numbers are generated THEN they SHALL be longer than 5 characters for better uniqueness
3. WHEN I view any project modal THEN the system SHALL display the order reference number prominently
4. WHEN order reference numbers are created THEN they SHALL be stored in the Supabase database
5. WHEN projects are displayed THEN the order reference number SHALL be visible in client, agent, and worker dashboards
6. WHEN searching projects THEN the system SHALL allow search by order reference number
7. WHEN order reference numbers are generated THEN they SHALL follow a consistent format

### Requirement 8: Enhanced Pricing Calculation with Deadline Charges

**User Story:** As a client creating a new assignment, I want pricing to reflect urgency based on deadline, so that I understand the cost implications of tight deadlines.

#### Acceptance Criteria

1. WHEN I create a new assignment THEN the system SHALL calculate pricing based on existing formula plus deadline charges
2. WHEN deadline is over 7 days from request date THEN the system SHALL apply no additional charge
3. WHEN deadline is between 3 to 6 days from request date THEN the system SHALL add £5 to the price
4. WHEN deadline is 2 days from request date THEN the system SHALL add £10 to the price
5. WHEN deadline is 1 day from request date THEN the system SHALL add £30 to the price
6. WHEN pricing is calculated THEN the system SHALL show breakdown of base price and deadline charges
7. WHEN deadline charges are applied THEN they SHALL be reflected in the notification system and database

### Requirement 9: Enhanced User Interface Design

**User Story:** As any user, I want an improved and polished user interface, so that I can have a better user experience while using the application.

#### Acceptance Criteria

1. WHEN I interact with modals THEN they SHALL have improved visual design and animations
2. WHEN I use dropdowns THEN they SHALL have enhanced styling and smooth interactions
3. WHEN I use the date picker THEN it SHALL have improved visual design and usability
4. WHEN I navigate between pages THEN the system SHALL show smooth transition animations
5. WHEN popups appear THEN they SHALL have smooth entrance and exit animations
6. WHEN loading states occur THEN they SHALL be handled smoothly without getting stuck
7. WHEN the loading logo appears THEN it SHALL have proper timeout and error handling
8. WHEN UI elements are updated THEN they SHALL maintain consistency across all dashboards
9. WHEN animations play THEN they SHALL be smooth and not interfere with functionality
10. WHEN design improvements are made THEN they SHALL enhance usability without breaking existing functionality