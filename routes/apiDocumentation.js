import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// API Documentation endpoint
router.get('/', (req, res) => {
    const apiDocumentation = {
        title: "User Hierarchy and Reference Code System API",
        version: "1.0.0",
        description: "Comprehensive API for managing user hierarchies, reference codes, project assignments, and notifications",
        baseUrl: "/api",
        endpoints: {
            authentication: {
                description: "User authentication and authorization",
                endpoints: {
                    "POST /auth/register": {
                        description: "Register new user with reference code",
                        parameters: ["email", "password", "full_name", "reference_code"],
                        authentication: false
                    },
                    "POST /auth/login": {
                        description: "User login",
                        parameters: ["email", "password"],
                        authentication: false
                    },
                    "POST /auth/logout": {
                        description: "User logout",
                        authentication: true
                    }
                }
            },
            hierarchy: {
                description: "User hierarchy management",
                endpoints: {
                    "GET /hierarchy/my-hierarchy": {
                        description: "Get current user's hierarchy information",
                        authentication: true
                    },
                    "GET /hierarchy/my-network": {
                        description: "Get user's subordinates network",
                        authentication: true
                    }
                }
            },
            hierarchyOperations: {
                description: "Advanced hierarchy operations",
                endpoints: {
                    "GET /hierarchy-operations/tree": {
                        description: "Get complete hierarchy tree (Super Agent only)",
                        authentication: true,
                        permissions: ["view_hierarchy_tree"]
                    },
                    "GET /hierarchy-operations/network/:userId": {
                        description: "Get user's complete network with statistics",
                        authentication: true,
                        permissions: ["view_user_network"]
                    },
                    "PUT /hierarchy-operations/move-user": {
                        description: "Move user in hierarchy",
                        parameters: ["userId", "newParentId", "reason"],
                        authentication: true,
                        permissions: ["manage_hierarchy"]
                    },
                    "GET /hierarchy-operations/statistics": {
                        description: "Get hierarchy statistics",
                        authentication: true,
                        permissions: ["view_hierarchy_stats"]
                    },
                    "GET /hierarchy-operations/search": {
                        description: "Search users in hierarchy",
                        parameters: ["query", "role?", "hierarchy_level?", "limit?"],
                        authentication: true
                    },
                    "GET /hierarchy-operations/path/:userId": {
                        description: "Get hierarchy path for a user",
                        authentication: true
                    }
                }
            },
            referenceCodes: {
                description: "Reference code management",
                endpoints: {
                    "POST /reference-codes/validate": {
                        description: "Validate reference code (public)",
                        parameters: ["code"],
                        authentication: false
                    },
                    "GET /reference-codes/my-codes": {
                        description: "Get user's reference codes with statistics",
                        authentication: true,
                        permissions: ["view_reference_codes"]
                    },
                    "POST /reference-codes/generate": {
                        description: "Generate new reference codes",
                        authentication: true,
                        permissions: ["generate_reference_codes"]
                    },
                    "PATCH /reference-codes/:codeId/deactivate": {
                        description: "Deactivate reference code",
                        authentication: true
                    },
                    "POST /reference-codes/:codeId/regenerate": {
                        description: "Regenerate reference code",
                        authentication: true
                    },
                    "GET /reference-codes/:codeId/stats": {
                        description: "Get usage statistics for reference code",
                        authentication: true
                    },
                    "GET /reference-codes/:codeId/recruited-users": {
                        description: "Get users recruited by reference code",
                        authentication: true
                    }
                }
            },
            projectAssignment: {
                description: "Enhanced project assignment management",
                endpoints: {
                    "POST /project-assignment/assign": {
                        description: "Assign user to project with hierarchy validation",
                        parameters: ["projectId", "assigneeId", "assignmentType", "assignmentReason?", "assignmentNotes?"],
                        authentication: true,
                        permissions: ["assign_projects"]
                    },
                    "POST /project-assignment/bulk-assign": {
                        description: "Bulk assign multiple users to project",
                        parameters: ["projectId", "assignments[]"],
                        authentication: true,
                        permissions: ["assign_projects"]
                    },
                    "GET /project-assignment/history/:projectId": {
                        description: "Get assignment history for project",
                        authentication: true,
                        permissions: ["view_project_assignments"]
                    },
                    "GET /project-assignment/projects-with-hierarchy": {
                        description: "Get projects with complete hierarchy information",
                        authentication: true
                    },
                    "POST /project-assignment/validate": {
                        description: "Validate assignment before making it",
                        parameters: ["assigneeId", "assigneeRole", "assignmentType"],
                        authentication: true
                    },
                    "GET /project-assignment/available-users/:assignmentType": {
                        description: "Get available users for assignment",
                        authentication: true
                    },
                    "GET /project-assignment/recommendations/:projectId/:assignmentType": {
                        description: "Get assignment recommendations with workload analysis",
                        authentication: true
                    },
                    "GET /project-assignment/statistics": {
                        description: "Get assignment statistics for user",
                        authentication: true
                    },
                    "PUT /project-assignment/project-numbers/:projectId": {
                        description: "Update project numbers",
                        parameters: ["projectNumbers[]"],
                        authentication: true,
                        permissions: ["edit_projects"]
                    }
                }
            },
            agentPricing: {
                description: "Agent pricing configuration and management",
                endpoints: {
                    "GET /agent-pricing/current": {
                        description: "Get current agent's pricing configuration",
                        authentication: true,
                        permissions: ["view_agent_pricing"]
                    },
                    "PUT /agent-pricing/current": {
                        description: "Update current agent's pricing configuration",
                        parameters: ["min_word_count", "max_word_count", "base_rate_per_500_words", "agent_fee_percentage", "change_reason?"],
                        authentication: true,
                        permissions: ["manage_agent_pricing"]
                    },
                    "GET /agent-pricing/history/current": {
                        description: "Get pricing history for current agent",
                        authentication: true,
                        permissions: ["view_agent_pricing"]
                    },
                    "POST /agent-pricing/calculate": {
                        description: "Calculate pricing for word count",
                        parameters: ["word_count", "agent_id?"],
                        authentication: true
                    },
                    "POST /agent-pricing/validate": {
                        description: "Validate pricing configuration",
                        parameters: ["min_word_count", "max_word_count", "base_rate_per_500_words", "agent_fee_percentage"],
                        authentication: true
                    },
                    "GET /agent-pricing/overview": {
                        description: "Get all agents' pricing overview (Super Agent only)",
                        authentication: true,
                        permissions: ["view_all_agent_pricing"]
                    }
                }
            },
            financialSecurity: {
                description: "Financial data security and access control",
                endpoints: {
                    "GET /financial-security/permissions": {
                        description: "Get financial permissions for current user",
                        authentication: true
                    },
                    "GET /financial-security/summary": {
                        description: "Get financial summary with role-based filtering",
                        authentication: true
                    },
                    "GET /financial-security/projects": {
                        description: "Get projects with financial data filtering",
                        authentication: true
                    },
                    "GET /financial-security/audit": {
                        description: "Get financial access audit logs (Super Agent only)",
                        authentication: true
                    },
                    "POST /financial-security/validate-access": {
                        description: "Validate specific financial access",
                        parameters: ["permission", "resourceId?", "resourceType?"],
                        authentication: true
                    }
                }
            },
            notifications: {
                description: "Hierarchy-aware notification system",
                endpoints: {
                    "POST /notifications/send": {
                        description: "Send hierarchy-aware notification",
                        parameters: ["targetUsers[]", "title", "body", "notificationType?", "projectId?"],
                        authentication: true
                    },
                    "POST /notifications/broadcast": {
                        description: "Broadcast notification to all subordinates",
                        parameters: ["title", "body", "notificationType?", "includeClients?"],
                        authentication: true
                    },
                    "GET /notifications/my-notifications": {
                        description: "Get user's notifications with hierarchy context",
                        parameters: ["limit?", "offset?", "unreadOnly?"],
                        authentication: true
                    },
                    "PUT /notifications/mark-read": {
                        description: "Mark notifications as read",
                        parameters: ["notificationIds[]?", "markAll?"],
                        authentication: true
                    },
                    "GET /notifications/templates": {
                        description: "Get notification templates for user role",
                        authentication: true
                    },
                    "POST /notifications/send-template": {
                        description: "Send templated notification",
                        parameters: ["templateName", "targetUsers[]", "variables?", "projectId?"],
                        authentication: true
                    },
                    "GET /notifications/preferences": {
                        description: "Get notification preferences",
                        authentication: true
                    },
                    "PUT /notifications/preferences": {
                        description: "Update notification preferences",
                        parameters: ["preferences[]"],
                        authentication: true
                    }
                }
            },
            permissions: {
                description: "Role-based permission management",
                endpoints: {
                    "GET /permissions/my-permissions": {
                        description: "Get current user's permissions",
                        authentication: true
                    },
                    "POST /permissions/check": {
                        description: "Check specific permission",
                        parameters: ["permission"],
                        authentication: true
                    },
                    "GET /permissions/accessible-projects": {
                        description: "Get projects accessible to current user",
                        authentication: true
                    }
                }
            }
        },
        errorCodes: {
            400: "Bad Request - Invalid parameters",
            401: "Unauthorized - Authentication required",
            403: "Forbidden - Insufficient permissions",
            404: "Not Found - Resource not found",
            500: "Internal Server Error - Server error"
        },
        authentication: {
            type: "Bearer Token",
            header: "Authorization: Bearer <token>",
            description: "Include JWT token in Authorization header for authenticated endpoints"
        },
        permissions: {
            description: "Role-based permissions system",
            roles: ["super_agent", "agent", "super_worker", "worker", "client"],
            hierarchy: "super_agent > agent > super_worker > worker, client"
        }
    };
    
    res.json(apiDocumentation);
});

// Get API health status
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
            database: 'connected',
            authentication: 'active',
            hierarchy: 'active',
            notifications: 'active',
            assignments: 'active'
        }
    });
});

// Get API statistics (authenticated)
router.get('/statistics', authenticateToken, async (req, res) => {
    try {
        // This would typically come from a monitoring service
        res.json({
            success: true,
            data: {
                total_endpoints: 50,
                active_users: 'N/A',
                requests_today: 'N/A',
                average_response_time: 'N/A',
                uptime: 'N/A'
            },
            message: 'API statistics endpoint - implement with monitoring service'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get API statistics'
        });
    }
});

export default router;