# User Hierarchy and Reference Code System

## Overview

The User Hierarchy and Reference Code System is a comprehensive web application designed to manage organizational hierarchies, reference codes for user recruitment, project assignments, and role-based permissions. The system supports five distinct user roles with specific capabilities and maintains a structured hierarchy for effective management.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [User Roles and Permissions](#user-roles-and-permissions)
3. [Key Features](#key-features)
4. [Installation Guide](#installation-guide)
5. [API Documentation](#api-documentation)
6. [User Guides](#user-guides)
7. [Database Schema](#database-schema)
8. [Deployment](#deployment)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Troubleshooting](#troubleshooting)

## System Architecture

### Technology Stack

- **Frontend**: React 18 with TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: Local filesystem with configurable paths
- **Environment**: Docker-ready with environment variables

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React/TS)    │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ - Dashboards    │    │ - REST APIs     │    │ - User Data     │
│ - Components    │    │ - Auth System   │    │ - Hierarchy     │
│ - Role-based UI │    │ - Permissions   │    │ - Projects      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## User Roles and Permissions

### Role Hierarchy

```
Super Agent (Level 1)
├── Agent (Level 2)
│   ├── Super Worker (Level 3)
│   │   └── Worker (Level 4)
│   └── Client (Level 3)
└── Direct Clients (Level 2)
```

### Role Capabilities

| Role | Key Permissions | Dashboard Features |
|------|----------------|-----------------------|
| **Super Agent** | Full system access, manage all users, view all financials | System analytics, user management, broadcast notifications |
| **Agent** | Manage subordinates, set pricing, view agent fees | Client management, pricing configuration, project oversight |
| **Super Worker** | Assign workers, manage sub-projects | Worker assignment, project tracking, team management |
| **Worker** | View assigned projects, update status | Project dashboard, task management |
| **Client** | Submit projects, view own data | Project submission, status tracking, pricing view |

## Key Features

### 🏗️ Hierarchy Management
- **Multi-level Organization**: Support for 5-level hierarchy structure
- **Dynamic Assignment**: Automatic hierarchy assignment during registration
- **Hierarchy Validation**: Business rules enforcement for assignments
- **Network Analysis**: Complete subordinate network with statistics

### 🔗 Reference Code System
- **Code Generation**: Automatic generation of unique reference codes
- **Usage Tracking**: Monitor recruitment success and patterns
- **Code Management**: Activate, deactivate, regenerate codes
- **Analytics**: Detailed usage statistics and recruitment metrics

### 📋 Project Assignment
- **Hierarchy-Based Assignment**: Assignments follow organizational structure
- **Assignment History**: Complete audit trail of all assignments
- **Workload Balancing**: Intelligent assignment recommendations
- **Multiple Project Numbers**: Support for complex project referencing

### 💰 Agent Pricing System
- **Configurable Pricing**: Agents can set their own pricing structure
- **Pricing History**: Track all pricing changes with reasons
- **Dynamic Calculator**: Real-time pricing calculations
- **Performance Analytics**: Pricing recommendations based on performance

### 🔒 Financial Security
- **Role-Based Data Filtering**: Financial data filtered by user role
- **Access Audit**: Complete audit trail of financial data access
- **Permission Validation**: Granular permission checking
- **Data Protection**: Sensitive financial data protection

### 🔔 Notification System
- **Hierarchy-Aware Notifications**: Notifications respect organizational structure
- **Template System**: Configurable notification templates
- **Broadcast Capabilities**: Send to all subordinates
- **Preference Management**: User-configurable notification settings

## Installation Guide

See [Installation Guide](./INSTALLATION.md) for detailed setup instructions.

## API Documentation

See [API Documentation](./API.md) for complete endpoint reference.

## User Guides

- [Super Agent Guide](./user-guides/SUPER_AGENT.md)
- [Agent Guide](./user-guides/AGENT.md)
- [Super Worker Guide](./user-guides/SUPER_WORKER.md)
- [Worker Guide](./user-guides/WORKER.md)
- [Client Guide](./user-guides/CLIENT.md)

## Database Schema

See [Database Schema](./DATABASE.md) for complete schema documentation.

## Deployment

See [Deployment Guide](./DEPLOYMENT.md) for production deployment instructions.

## Monitoring and Maintenance

See [Operations Guide](./OPERATIONS.md) for monitoring and maintenance procedures.

## Troubleshooting

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for common issues and solutions.

## Support

For technical support or questions:
- Check the troubleshooting guide first
- Review the API documentation
- Contact the development team

## License

This system is proprietary software. All rights reserved.

---

**Version**: 1.0.0  
**Last Updated**: December 2025  
**Maintained By**: Development Team