# Web App Feature Requirements - User Hierarchy & Reference Code System

## User Role Structure
The system now supports 5 distinct user roles with hierarchical relationships:

1. **Super Agent** (Top-level administrator)
2. **Agent** (Sub-agent under Super Agent)  
3. **Client** (End users who submit projects)
4. **Super Worker** (Top-level worker/freelancer)
5. **Worker** (Sub-worker under Super Worker)

## Reference Code Assignment System

### Code Distribution
- **Super Agent**: Has 2 reference codes
  - One code for recruiting Agents
  - One code for recruiting Clients
- **Agent**: Has 1 reference code for recruiting Clients
- **Super Worker**: Has 1 reference code for recruiting Workers

### Registration Process
1. During registration, all users must enter a reference code (required field)
2. System queries database to identify which Super Agent/Agent/Super Worker owns that code
3. User is automatically assigned to the code owner's network
4. All assignments ultimately roll up to the Super Agent level

## Database Schema Updates

### New Fields Required
- `projects` table: Add `sub-worker-id` and `sub-agent-id` fields
- `assignments` table: Add `project_numbers` text field for multiple project references (e.g., "A1, A2, A3, Full Project")

### Reference Code Tracking
- Track which user owns each reference code
- Maintain assignment relationships between users and their recruiters

## Dashboard Functionality by Role

### Super Agent Dashboard
**Features:**
- View all projects with profit calculations
- Manage Agent database with pricing controls
- Set base prices for each sub-agent (includes 500-word rate + fees)
- View "to be paid" amounts split between Super Worker and Agent fees
- Broadcasting notifications to all users
- Complete project status management

**Project View:**
- Shows profit margins
- Displays assignment details ("assigned to agent [name]" for sub-agent projects)
- Full financial overview

### Agent Dashboard
**Features:**
- View projects from their assigned clients only
- Settings tab for pricing configuration (500-20,000 words)
- Analytics showing fees and amounts owed to Super Agent
- Search/filter by order reference and client name
- No project status modification rights

**Pricing System:**
- Clients see pricing based on Agent's word count settings
- Pricing calculator updates dynamically based on project word count

### Super Worker Dashboard
**Features:**
- Assign projects to sub-workers
- Maintain standard rate: 6.25 × 500 words + agent referral fees
- Send notifications to assigned sub-workers
- Manage sub-worker assignments

### Worker Dashboard
**Features:**
- View only assigned projects
- No financial information visible (no profit/pricing data)
- Receive assignment notifications from Super Worker

### Client Dashboard
**Features:**
- Submit new assignments with project numbers
- View pricing based on assigned Agent's rate structure
- See project status and updates
- Pricing automatically calculated by word count

## Pricing & Payment Structure

### Rate Framework
- **Base Rate**: Super Worker receives 6.25 per 500 words
- **Agent Fee**: Added to base rate for client acquisition
- **Super Agent Control**: Sets all agent base prices and fee structures

### Profit Distribution
- Super Agent sees total profit per project
- Profit split calculated between Super Worker payment and Agent fees
- Agents see their fee structure and amounts owed to Super Agent

## Permission Matrix

| Feature | Super Agent | Agent | Client | Super Worker | Worker |
|---------|-------------|-------|---------|--------------|---------|
| Change project status | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set pricing | ✅ | ✅ (own rates) | ❌ | ❌ | ❌ |
| View all projects | ✅ | ❌ (own only) | ❌ (own only) | ✅ | ❌ (assigned only) |
| Assign workers | ❌ | ❌ | ❌ | ✅ | ❌ |
| Send notifications | ✅ | ❌ | ❌ | ✅ (to sub-workers) | ❌ |
| View financial data | ✅ | ✅ (own fees) | ✅ (pricing) | ✅ | ❌ |

## Implementation Notes

### Registration Flow
1. User enters reference code during registration
2. System validates code exists in database
3. System identifies code owner (Super Agent/Agent/Super Worker)
4. User is assigned to appropriate hierarchy level
5. Permissions and dashboard access granted based on role

### Notification System
- Super Agent: Can broadcast to all users
- Super Worker: Can notify assigned sub-workers
- System notifications for project assignments and status changes

### Data Security
- Workers cannot see financial information
- Agents only see their own client projects and fee structures
- All status changes controlled exclusively by Super Agent