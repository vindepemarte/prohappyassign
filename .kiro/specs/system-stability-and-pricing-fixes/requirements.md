# Requirements Document

## Introduction

This feature addresses critical system stability issues affecting all user roles (Super Agent, Super Worker, Agent, Worker, Client) and fixes the pricing calculation system that is preventing clients from creating assignments. The system is currently experiencing widespread API failures (500, 403, 404 errors) and the pricing calculation is not functioning, which blocks core business functionality.

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want all API endpoints to function correctly across all user roles, so that users can access their dashboards and perform their intended actions without encountering server errors.

#### Acceptance Criteria

1. WHEN any user logs in THEN the system SHALL load their dashboard without 500 internal server errors
2. WHEN a user accesses notification endpoints THEN the system SHALL return proper responses without 500 errors
3. WHEN users access role-specific endpoints THEN the system SHALL return appropriate data or proper 403 responses with clear error messages
4. WHEN the system encounters permission issues THEN it SHALL return consistent 403 responses with meaningful error descriptions
5. IF an endpoint does not exist THEN the system SHALL return proper 404 responses instead of causing cascading failures

### Requirement 2

**User Story:** As a client, I want to create assignments with accurate pricing calculations, so that I can submit work requests and see the correct costs upfront.

#### Acceptance Criteria

1. WHEN a client creates an assignment THEN the system SHALL calculate pricing based on the assigned agent's pricing structure
2. WHEN a client is assigned to a Super Agent THEN the system SHALL use the Super Agent pricing table (£45 for 0-500 words, £55 for 501-1000 words, etc.)
3. WHEN a client is assigned to a Normal Agent THEN the system SHALL use that agent's custom pricing table
4. WHEN urgency is selected THEN the system SHALL add the correct urgency fees (£30 next day, £10 for 2-3 days, £5 for 4-7 days)
5. WHEN pricing is calculated THEN the system SHALL display the breakdown to the client before assignment creation

### Requirement 3

**User Story:** As a Super Worker, I want to see my earnings calculated at £6.25 per 500 words in both GBP and INR, so that I can track my compensation accurately.

#### Acceptance Criteria

1. WHEN a Super Worker accesses analytics THEN the system SHALL calculate earnings at £6.25 per 500-word increment
2. WHEN displaying Super Worker earnings THEN the system SHALL show amounts in both British Pounds and Indian Rupees
3. WHEN calculating word-based payments THEN the system SHALL round up partial 500-word increments to the next full increment
4. WHEN the currency conversion is displayed THEN the system SHALL use current exchange rates or a configured rate

### Requirement 4

**User Story:** As a Super Agent, I want to see analytics showing my profit after paying Super Workers and Normal Agents, so that I can understand my actual earnings from assignments.

#### Acceptance Criteria

1. WHEN a Super Agent views analytics THEN the system SHALL show total revenue from Super Agent pricing table
2. WHEN calculating Super Agent profit THEN the system SHALL deduct £6.25 per 500 words paid to Super Workers
3. WHEN clients are assigned through Normal Agents THEN the system SHALL deduct the Normal Agent's fees from Super Agent profit
4. WHEN displaying profit breakdown THEN the system SHALL show: total revenue, Super Worker payments, Normal Agent payments, and net profit
5. WHEN analytics are calculated THEN the system SHALL only deduct Normal Agent fees for clients actually assigned through that agent

### Requirement 5

**User Story:** As a Normal Agent, I want to see analytics showing my earnings and what I owe to the Super Agent, so that I can track my financial obligations and profits.

#### Acceptance Criteria

1. WHEN a Normal Agent views analytics THEN the system SHALL show earnings based on their custom pricing table
2. WHEN calculating Normal Agent obligations THEN the system SHALL include Super Worker fees (£6.25 per 500 words) in the amount owed to Super Agent
3. WHEN displaying financial breakdown THEN the system SHALL show: total earnings, amount owed to Super Agent (including Super Worker fees), and net profit
4. WHEN Super Worker fees are calculated THEN the system SHALL be included in the Super Agent payment obligation

### Requirement 6

**User Story:** As any user role, I want the notification system to work reliably, so that I can receive important updates about assignments and system activities.

#### Acceptance Criteria

1. WHEN accessing notification endpoints THEN the system SHALL return proper responses without server errors
2. WHEN notification history is requested THEN the system SHALL return formatted notification data or empty arrays
3. WHEN notifications fail to load THEN the system SHALL provide graceful fallbacks instead of repeated error attempts
4. WHEN notification permissions are insufficient THEN the system SHALL return clear 403 responses with actionable messages
5. IF notification data is unavailable THEN the system SHALL display appropriate empty states to users