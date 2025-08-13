# Design Document

## Overview

This design document outlines the implementation of a comprehensive user hierarchy system with reference code-based recruitment for the existing project management application. The system will extend the current 3-role structure (client, worker, agent) to a 5-role hierarchy (Super Agent, Agent, Client, Super Worker, Worker) while maintaining compatibility with the existing PostgreSQL database and React/TypeScript frontend architecture.

## Architecture

### Current System Analysis

The existing system uses:
- PostgreSQL database with connection pooling
- JWT-based authentication with session management
- React/TypeScript frontend with role-based dashboard routing
- Role-based permissions enforced at both API and UI levels

### Enhanced Architecture Components

1. **Database Layer**: Extended PostgreSQL schema with new tables and fields
2. **Authentication Layer**: Enhanced JWT tokens with hierarchy information
3. **API Layer**: New endpoints for hierarchy management and reference codes
4. **Frontend Layer**: Updated dashboards and role-based routing
5. **Permission Layer**: Enhanced role-based access control system

## Components and Interfaces

### 1. Database Schema Extensions

#### New Tables

```sql
-- Reference codes table
CREATE TABLE reference_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('agent_recruitment', 'client_recruitment', 'worker_recruitment')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User hierarchy relationships
CREATE TABLE user_hierarchy (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    parent_id UUID REFERENCES users(id),
    hierarchy_level INTEGER NOT NULL,
    super_agent_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Agent pricing configuration
CREATE TABLE agent_pricing (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES users(id),
    min_word_count INTEGER DEFAULT 500,
    max_word_count INTEGER DEFAULT 20000,
    base_rate_per_500_words DECIMAL(10,2) NOT NULL,
    agent_fee_percentage DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(agent_id)
);
```

#### Modified Tables

```sql
-- Extend users table
ALTER TABLE users 
ADD COLUMN reference_code_used VARCHAR(20),
ADD COLUMN recruited_by UUID REFERENCES users(id),
ADD COLUMN super_agent_id UUID REFERENCES users(id);

-- Update user_role enum
ALTER TYPE user_role ADD VALUE 'super_agent';
ALTER TYPE user_role ADD VALUE 'super_worker';

-- Extend projects table
ALTER TABLE projects 
ADD COLUMN sub_worker_id UUID REFERENCES users(id),
ADD COLUMN sub_agent_id UUID REFERENCES users(id);

-- Extend assignments table (if exists) or create
ALTER TABLE assignments 
ADD COLUMN project_numbers TEXT;
```

### 2. Enhanced Authentication System

#### Updated User Interface

```typescript
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'client' | 'worker' | 'agent' | 'super_agent' | 'super_worker';
  avatar_url: string | null;
  email_verified: boolean;
  reference_code_used: string | null;
  recruited_by: string | null;
  super_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserHierarchy {
  user_id: string;
  parent_id: string | null;
  hierarchy_level: number;
  super_agent_id: string;
}

export interface ReferenceCode {
  id: number;
  code: string;
  owner_id: string;
  code_type: 'agent_recruitment' | 'client_recruitment' | 'worker_recruitment';
  is_active: boolean;
}
```

#### Enhanced Registration Flow

```typescript
export interface RegistrationData {
  email: string;
  password: string;
  full_name: string;
  reference_code: string; // Required field
}

export interface RegistrationResult extends AuthResult {
  hierarchy_info: UserHierarchy;
  assigned_role: UserRole;
}
```

### 3. Reference Code Management System

#### Reference Code Service

```typescript
export class ReferenceCodeService {
  // Generate reference codes for new users
  static async generateCodesForUser(userId: string, role: UserRole): Promise<ReferenceCode[]>
  
  // Validate reference code during registration
  static async validateReferenceCode(code: string): Promise<{
    isValid: boolean;
    owner: User | null;
    codeType: string | null;
  }>
  
  // Get user's reference codes
  static async getUserReferenceCodes(userId: string): Promise<ReferenceCode[]>
  
  // Deactivate reference code
  static async deactivateReferenceCode(codeId: number): Promise<void>
}
```

### 4. Hierarchy Management System

#### Hierarchy Service

```typescript
export class HierarchyService {
  // Assign user to hierarchy based on reference code
  static async assignUserToHierarchy(
    userId: string, 
    referenceCode: string
  ): Promise<UserHierarchy>
  
  // Get user's network (subordinates)
  static async getUserNetwork(userId: string): Promise<User[]>
  
  // Get hierarchy path for user
  static async getHierarchyPath(userId: string): Promise<User[]>
  
  // Check if user can access another user's data
  static async canAccessUser(requesterId: string, targetUserId: string): Promise<boolean>
}
```

### 5. Enhanced Dashboard Components

#### Dashboard Router Enhancement

```typescript
const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <LoadingDashboard />;
  }

  switch (user.role) {
    case 'client':
      return <ClientDashboard />;
    case 'worker':
      return <WorkerDashboard />;
    case 'agent':
      return <AgentDashboard />;
    case 'super_agent':
      return <SuperAgentDashboard />;
    case 'super_worker':
      return <SuperWorkerDashboard />;
    default:
      return <UnknownRoleDashboard />;
  }
};
```

#### New Dashboard Components

```typescript
// Super Agent Dashboard
export interface SuperAgentDashboardProps {
  // Full system access with profit calculations
  // Agent management with pricing controls
  // Broadcasting capabilities
}

// Super Worker Dashboard  
export interface SuperWorkerDashboardProps {
  // Project assignment to sub-workers
  // Standard rate management
  // Sub-worker notifications
}
```

### 6. Permission System Enhancement

#### Role-Based Access Control

```typescript
export enum Permission {
  // Project permissions
  VIEW_ALL_PROJECTS = 'view_all_projects',
  VIEW_OWN_PROJECTS = 'view_own_projects',
  VIEW_ASSIGNED_PROJECTS = 'view_assigned_projects',
  CHANGE_PROJECT_STATUS = 'change_project_status',
  
  // User management permissions
  MANAGE_AGENTS = 'manage_agents',
  ASSIGN_WORKERS = 'assign_workers',
  VIEW_FINANCIAL_DATA = 'view_financial_data',
  
  // Pricing permissions
  SET_GLOBAL_PRICING = 'set_global_pricing',
  SET_OWN_PRICING = 'set_own_pricing',
  
  // Notification permissions
  BROADCAST_NOTIFICATIONS = 'broadcast_notifications',
  SEND_WORKER_NOTIFICATIONS = 'send_worker_notifications'
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_agent: [
    Permission.VIEW_ALL_PROJECTS,
    Permission.CHANGE_PROJECT_STATUS,
    Permission.MANAGE_AGENTS,
    Permission.VIEW_FINANCIAL_DATA,
    Permission.SET_GLOBAL_PRICING,
    Permission.BROADCAST_NOTIFICATIONS
  ],
  agent: [
    Permission.VIEW_OWN_PROJECTS,
    Permission.VIEW_FINANCIAL_DATA,
    Permission.SET_OWN_PRICING
  ],
  client: [
    Permission.VIEW_OWN_PROJECTS
  ],
  super_worker: [
    Permission.VIEW_ALL_PROJECTS,
    Permission.ASSIGN_WORKERS,
    Permission.VIEW_FINANCIAL_DATA,
    Permission.SEND_WORKER_NOTIFICATIONS
  ],
  worker: [
    Permission.VIEW_ASSIGNED_PROJECTS
  ]
};
```

## Data Models

### Enhanced Project Model

```typescript
export interface Project {
  id: number;
  client_id: string;
  worker_id: string | null;
  agent_id: string | null;
  sub_worker_id: string | null;  // New field
  sub_agent_id: string | null;   // New field
  title: string;
  description: string | null;
  status: ProjectStatus;
  initial_word_count: number;
  adjusted_word_count: number | null;
  cost_gbp: number;
  deadline: string;
  order_reference: string | null;
  deadline_charge: number;
  urgency_level: UrgencyLevel;
  created_at: string;
  updated_at: string;
}
```

### Agent Pricing Model

```typescript
export interface AgentPricing {
  id: number;
  agent_id: string;
  min_word_count: number;
  max_word_count: number;
  base_rate_per_500_words: number;
  agent_fee_percentage: number;
  created_at: string;
  updated_at: string;
}
```

### Assignment Model Enhancement

```typescript
export interface Assignment {
  id: number;
  project_id: number;
  assigned_by: string;
  assigned_to: string;
  project_numbers: string; // New field for multiple project references
  created_at: string;
  updated_at: string;
}
```

## Error Handling

### Hierarchy-Specific Error Types

```typescript
export class HierarchyError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'HierarchyError';
  }
}

export class ReferenceCodeError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ReferenceCodeError';
  }
}

// Error codes
export const HIERARCHY_ERROR_CODES = {
  INVALID_REFERENCE_CODE: 'INVALID_REFERENCE_CODE',
  REFERENCE_CODE_EXPIRED: 'REFERENCE_CODE_EXPIRED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  INVALID_HIERARCHY_LEVEL: 'INVALID_HIERARCHY_LEVEL',
  CIRCULAR_HIERARCHY: 'CIRCULAR_HIERARCHY'
};
```

### Error Handling Strategy

1. **Registration Errors**: Clear validation messages for invalid reference codes
2. **Permission Errors**: Graceful degradation with appropriate UI feedback
3. **Hierarchy Errors**: Detailed logging for debugging while showing user-friendly messages
4. **Database Errors**: Transaction rollback for hierarchy operations

## Testing Strategy

### Unit Tests

1. **Reference Code Generation**: Test unique code generation and validation
2. **Hierarchy Assignment**: Test proper user assignment to hierarchy levels
3. **Permission Checking**: Test role-based access control logic
4. **Pricing Calculations**: Test agent-specific pricing calculations

### Integration Tests

1. **Registration Flow**: End-to-end registration with reference code validation
2. **Dashboard Access**: Test role-based dashboard routing and data access
3. **Project Assignment**: Test project assignment across hierarchy levels
4. **Notification System**: Test hierarchy-aware notification delivery

### Database Tests

1. **Schema Migrations**: Test database schema updates and data migration
2. **Constraint Validation**: Test foreign key constraints and data integrity
3. **Performance Tests**: Test query performance with hierarchy joins
4. **Transaction Tests**: Test rollback scenarios for hierarchy operations

### Frontend Tests

1. **Component Rendering**: Test role-specific dashboard components
2. **Permission UI**: Test UI elements based on user permissions
3. **Form Validation**: Test reference code input validation
4. **Navigation**: Test role-based navigation and route protection

## Security Considerations

### Authentication Security

1. **JWT Enhancement**: Include hierarchy information in JWT tokens
2. **Session Management**: Track hierarchy changes in user sessions
3. **Reference Code Security**: Implement rate limiting for code validation attempts

### Authorization Security

1. **Hierarchical Access Control**: Ensure users can only access subordinate data
2. **Financial Data Protection**: Strict access control for financial information
3. **Admin Operations**: Additional verification for Super Agent operations

### Data Security

1. **Reference Code Storage**: Hash reference codes in database
2. **Hierarchy Validation**: Prevent circular hierarchy relationships
3. **Audit Logging**: Log all hierarchy changes and access attempts

## Performance Considerations

### Database Optimization

1. **Indexing Strategy**: Add indexes on hierarchy relationships and reference codes
2. **Query Optimization**: Optimize hierarchy traversal queries
3. **Connection Pooling**: Maintain existing connection pool configuration

### Frontend Optimization

1. **Component Lazy Loading**: Lazy load role-specific dashboard components
2. **Data Caching**: Cache hierarchy information in frontend state
3. **Permission Caching**: Cache user permissions to reduce API calls

### API Optimization

1. **Batch Operations**: Batch hierarchy queries where possible
2. **Response Caching**: Cache reference code validation results
3. **Rate Limiting**: Implement rate limiting for hierarchy operations

## Migration Strategy

### Database Migration

1. **Schema Updates**: Add new tables and columns with proper constraints
2. **Data Migration**: Migrate existing users to new hierarchy structure
3. **Reference Code Generation**: Generate initial reference codes for existing users

### Code Migration

1. **Backward Compatibility**: Maintain compatibility with existing 3-role system during transition
2. **Feature Flags**: Use feature flags to gradually roll out hierarchy features
3. **API Versioning**: Version APIs to support both old and new role systems

### User Migration

1. **Existing User Assignment**: Assign existing users to appropriate hierarchy levels
2. **Permission Migration**: Update existing permissions to new role structure
3. **Dashboard Migration**: Gradually migrate users to new dashboard interfaces