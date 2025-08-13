// TypeScript type definitions for the PostgreSQL database schema

export type UserRole = "client" | "worker" | "agent" | "super_agent" | "super_worker";
export type ProjectStatus =
  | "pending_payment_approval"
  | "rejected_payment"
  | "awaiting_worker_assignment"
  | "in_progress"
  | "pending_quote_approval"
  | "needs_changes"
  | "pending_final_approval"
  | "completed"
  | "refund"
  | "cancelled";
export type FilePurpose = "initial_brief" | "change_request" | "final_delivery";
export type UrgencyLevel = "normal" | "moderate" | "urgent" | "rush";
export type DeliveryStatus = "pending" | "sent" | "delivered" | "failed";
export type ExtensionStatus = "pending" | "approved" | "rejected";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: UserRole
          email_verified: boolean
          reference_code_used: string | null
          recruited_by: string | null
          super_agent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role: UserRole
          email_verified?: boolean
          reference_code_used?: string | null
          recruited_by?: string | null
          super_agent_id?: string | null
        }
        Update: {
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          email_verified?: boolean
          reference_code_used?: string | null
          recruited_by?: string | null
          super_agent_id?: string | null
        }
      }
      projects: {
        Row: {
          id: number
          client_id: string
          worker_id: string | null
          agent_id: string | null
          sub_worker_id: string | null
          sub_agent_id: string | null
          title: string
          description: string | null
          status: ProjectStatus
          initial_word_count: number
          adjusted_word_count: number | null
          cost_gbp: number
          deadline: string
          order_reference: string | null
          deadline_charge: number
          urgency_level: UrgencyLevel
          created_at: string
          updated_at: string
        }
        Insert: {
          client_id: string
          worker_id?: string | null
          agent_id?: string | null
          sub_worker_id?: string | null
          sub_agent_id?: string | null
          title: string
          description?: string | null
          status?: ProjectStatus
          initial_word_count: number
          adjusted_word_count?: number | null
          cost_gbp: number
          deadline: string
          order_reference?: string | null
          deadline_charge?: number
          urgency_level?: UrgencyLevel
        }
        Update: {
          worker_id?: string | null
          agent_id?: string | null
          sub_worker_id?: string | null
          sub_agent_id?: string | null
          title?: string
          description?: string | null
          status?: ProjectStatus
          initial_word_count?: number
          adjusted_word_count?: number | null
          cost_gbp?: number
          deadline?: string
          order_reference?: string | null
          deadline_charge?: number
          urgency_level?: UrgencyLevel
        }
      }
      project_files: {
        Row: {
          id: number
          project_id: number
          uploader_id: string
          file_name: string
          file_path: string
          purpose: FilePurpose
          uploaded_at: string
        }
        Insert: {
          project_id: number
          uploader_id: string
          file_name: string
          file_path: string
          purpose: FilePurpose
        }
        Update: {
          file_name?: string
          file_path?: string
          purpose?: FilePurpose
        }
      }
      project_notes: {
        Row: {
          id: number
          project_id: number
          author_id: string
          note: string
          created_at: string
        }
        Insert: {
          project_id: number
          author_id: string
          note: string
        }
        Update: {
          note?: string
        }
      }
      project_change_requests: {
        Row: {
          id: number
          project_id: number
          instructions: string
          created_at: string
        }
        Insert: {
          project_id: number
          instructions: string
        }
        Update: {
          instructions?: string
        }
      }
      push_subscriptions: {
        Row: {
          id: number
          user_id: string
          subscription: object
          created_at: string
        }
        Insert: {
          user_id: string
          subscription: object
        }
        Update: {
          subscription?: object
        }
      }
      deadline_extension_requests: {
        Row: {
          id: number
          project_id: number
          worker_id: string
          requested_deadline: string
          reason: string
          status: ExtensionStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          project_id: number
          worker_id: string
          requested_deadline: string
          reason: string
          status?: ExtensionStatus
        }
        Update: {
          requested_deadline?: string
          reason?: string
          status?: ExtensionStatus
        }
      }
      notification_history: {
        Row: {
          id: number
          user_id: string
          project_id: number | null
          title: string
          body: string
          delivery_status: DeliveryStatus
          retry_count: number
          created_at: string
          delivered_at: string | null
          error_message: string | null
        }
        Insert: {
          user_id: string
          project_id?: number | null
          title: string
          body: string
          delivery_status?: DeliveryStatus
          retry_count?: number
        }
        Update: {
          delivery_status?: DeliveryStatus
          retry_count?: number
          delivered_at?: string | null
          error_message?: string | null
        }
      }
      reference_codes: {
        Row: {
          id: number
          code: string
          owner_id: string
          code_type: 'agent_recruitment' | 'client_recruitment' | 'worker_recruitment'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          code: string
          owner_id: string
          code_type: 'agent_recruitment' | 'client_recruitment' | 'worker_recruitment'
          is_active?: boolean
        }
        Update: {
          code?: string
          owner_id?: string
          code_type?: 'agent_recruitment' | 'client_recruitment' | 'worker_recruitment'
          is_active?: boolean
        }
      }
      user_hierarchy: {
        Row: {
          id: number
          user_id: string
          parent_id: string | null
          hierarchy_level: number
          super_agent_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          parent_id?: string | null
          hierarchy_level: number
          super_agent_id: string
        }
        Update: {
          user_id?: string
          parent_id?: string | null
          hierarchy_level?: number
          super_agent_id?: string
        }
      }
      agent_pricing: {
        Row: {
          id: number
          agent_id: string
          min_word_count: number
          max_word_count: number
          base_rate_per_500_words: number
          agent_fee_percentage: number
          created_at: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          min_word_count?: number
          max_word_count?: number
          base_rate_per_500_words: number
          agent_fee_percentage: number
        }
        Update: {
          agent_id?: string
          min_word_count?: number
          max_word_count?: number
          base_rate_per_500_words?: number
          agent_fee_percentage?: number
        }
      }
      assignments: {
        Row: {
          id: number
          project_id: number
          assigned_by: string
          assigned_to: string
          project_numbers: string | null
          assignment_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          project_id: number
          assigned_by: string
          assigned_to: string
          project_numbers?: string | null
          assignment_type?: string
        }
        Update: {
          project_id?: number
          assigned_by?: string
          assigned_to?: string
          project_numbers?: string | null
          assignment_type?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      project_status: ProjectStatus
      file_purpose: FilePurpose
      urgency_level: UrgencyLevel
      delivery_status: DeliveryStatus
      extension_status: ExtensionStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Project = Database['public']['Tables']['projects']['Row'];
export type Profile = Database['public']['Tables']['users']['Row'];
export type ProjectFile = Database['public']['Tables']['project_files']['Row'];
export type ChangeRequest = Database['public']['Tables']['project_change_requests']['Row'];
export type DeadlineExtensionRequest = Database['public']['Tables']['deadline_extension_requests']['Row'];
export type NotificationHistory = Database['public']['Tables']['notification_history']['Row'];
export type ReferenceCode = Database['public']['Tables']['reference_codes']['Row'];
export type UserHierarchy = Database['public']['Tables']['user_hierarchy']['Row'];
export type AgentPricing = Database['public']['Tables']['agent_pricing']['Row'];
export type Assignment = Database['public']['Tables']['assignments']['Row'];

export type ProjectWithDetails = Project & {
    project_files: ProjectFile[];
    project_change_requests: ChangeRequest[];
    deadline_extension_requests?: DeadlineExtensionRequest[];
};

// Enhanced project interfaces for the new features
export interface PricingBreakdown {
  basePrice: number;
  deadlineCharge: number;
  totalPrice: number;
  urgencyLevel: UrgencyLevel;
  wordCount?: number;
  deadline?: Date;
  agentInfo?: {
    name: string;
    baseRate: number;
    feePercentage: number;
    agentFee: number;
  };
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


export interface NewProjectFormData {
  title: string;
  wordCount: number;
  deadline: string;
  guidance: string;
  files: File[];
  projectNumbers?: string; // Optional project numbers field
}

export interface ChangesFormData {
  projectId: number;
  instructions: string;
  files: File[];
}

// Hierarchy System Types
export type ReferenceCodeType = 'agent_recruitment' | 'client_recruitment' | 'worker_recruitment';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  email_verified: boolean;
  reference_code_used: string | null;
  recruited_by: string | null;
  super_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationData {
  email: string;
  password: string;
  full_name: string;
  reference_code: string; // Required field
}

export interface AuthResult {
  user: User;
  token: string;
  expires_at: string;
}

export interface RegistrationResult extends AuthResult {
  hierarchy_info: UserHierarchy;
  assigned_role: UserRole;
}

export interface ReferenceCodeValidation {
  isValid: boolean;
  owner: User | null;
  codeType: ReferenceCodeType | null;
}

// Permission System
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

// Enhanced Project interfaces
export interface ProjectWithHierarchy extends Project {
  sub_worker_name?: string;
  sub_agent_name?: string;
  assigned_by_name?: string;
}

// Agent Pricing interfaces
export interface AgentPricingConfig {
  min_word_count: number;
  max_word_count: number;
  base_rate_per_500_words: number;
  agent_fee_percentage: number;
}

export interface PricingCalculationResult {
  base_price: number;
  agent_fee: number;
  total_price: number;
  word_count: number;
  rate_per_500_words: number;
}

// Hierarchy Management interfaces
export interface UserNetwork {
  user: User;
  subordinates: User[];
  hierarchy_level: number;
}

export interface HierarchyPath {
  users: User[];
  levels: number[];
}

// Assignment interfaces
export interface ProjectAssignment {
  project_id: number;
  assigned_by: string;
  assigned_to: string;
  project_numbers: string | null;
  assignment_type: string;
}

// Error types for hierarchy operations
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

export const HIERARCHY_ERROR_CODES = {
  INVALID_REFERENCE_CODE: 'INVALID_REFERENCE_CODE',
  REFERENCE_CODE_EXPIRED: 'REFERENCE_CODE_EXPIRED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  INVALID_HIERARCHY_LEVEL: 'INVALID_HIERARCHY_LEVEL',
  CIRCULAR_HIERARCHY: 'CIRCULAR_HIERARCHY'
} as const;