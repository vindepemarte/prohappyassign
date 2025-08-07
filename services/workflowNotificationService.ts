import { supabase } from './supabase';
import { ProjectStatus, UserRole } from '../types';

interface NotificationPayload {
  title: string;
  body: string;
}

interface WorkflowNotificationConfig {
  userIds?: string[];
  roles?: UserRole[];
  excludeUserId?: string;
}

/**
 * Comprehensive workflow notification service
 * Handles all notifications for the C->A->W workflow
 */
export class WorkflowNotificationService {
  
  /**
   * Send notification to specific users and/or roles
   */
  private static async sendNotification(
    payload: NotificationPayload,
    config: WorkflowNotificationConfig,
    projectId?: number
  ): Promise<void> {
    try {
      let targetUserIds: string[] = [];

      // Add specific user IDs
      if (config.userIds) {
        targetUserIds.push(...config.userIds);
      }

      // Add users by role
      if (config.roles && config.roles.length > 0) {
        const { data: roleUsers, error } = await supabase
          .from('users')
          .select('id')
          .in('role', config.roles);

        if (!error && roleUsers) {
          targetUserIds.push(...roleUsers.map(u => u.id));
        }
      }

      // Remove duplicates and excluded user
      targetUserIds = [...new Set(targetUserIds)];
      if (config.excludeUserId) {
        targetUserIds = targetUserIds.filter(id => id !== config.excludeUserId);
      }

      // Send notifications to all target users
      if (targetUserIds.length > 0) {
        const notifications = targetUserIds.map(userId => ({
          user_id: userId,
          project_id: projectId,
          title: payload.title,
          body: payload.body,
          delivery_status: 'sent' as const,
          is_read: false
        }));

        const { error } = await supabase
          .from('notification_history')
          .insert(notifications);

        if (error) {
          console.error('Error sending workflow notifications:', error);
        } else {
          console.log(`Sent ${notifications.length} workflow notifications`);
        }
      }
    } catch (error) {
      console.error('Error in workflow notification service:', error);
    }
  }

  /**
   * C -> A: Client submits new project
   */
  static async notifyNewProjectSubmission(projectId: number, clientId: string, projectTitle: string): Promise<void> {
    await this.sendNotification(
      {
        title: '📋 New Project Submitted',
        body: `A new project "${projectTitle}" has been submitted and is pending payment approval.`
      },
      {
        roles: ['agent'],
        excludeUserId: clientId
      },
      projectId
    );
  }

  /**
   * A -> W: Agent approves payment and assigns to worker
   */
  static async notifyProjectAssignedToWorker(
    projectId: number, 
    workerId: string, 
    agentId: string, 
    projectTitle: string
  ): Promise<void> {
    await this.sendNotification(
      {
        title: '🎯 New Project Assignment',
        body: `You have been assigned to work on "${projectTitle}". The project is now in progress.`
      },
      {
        userIds: [workerId],
        excludeUserId: agentId
      },
      projectId
    );
  }

  /**
   * W -> A: Worker completes project and submits for final approval
   */
  static async notifyProjectCompletedByWorker(
    projectId: number, 
    workerId: string, 
    projectTitle: string
  ): Promise<void> {
    await this.sendNotification(
      {
        title: '✅ Project Completed',
        body: `"${projectTitle}" has been completed by the worker and is pending final approval.`
      },
      {
        roles: ['agent'],
        excludeUserId: workerId
      },
      projectId
    );
  }

  /**
   * W -> C: Worker requests word count adjustment
   */
  static async notifyWordCountAdjustmentRequest(
    projectId: number, 
    clientId: string, 
    workerId: string, 
    projectTitle: string,
    newWordCount: number
  ): Promise<void> {
    await this.sendNotification(
      {
        title: '📊 Word Count Adjustment Request',
        body: `The worker has requested to adjust the word count for "${projectTitle}" to ${newWordCount} words. Please review and approve.`
      },
      {
        userIds: [clientId],
        excludeUserId: workerId
      },
      projectId
    );
  }

  /**
   * W -> C: Worker requests deadline adjustment
   */
  static async notifyDeadlineAdjustmentRequest(
    projectId: number, 
    clientId: string, 
    workerId: string, 
    projectTitle: string,
    newDeadline: string
  ): Promise<void> {
    await this.sendNotification(
      {
        title: '📅 Deadline Adjustment Request',
        body: `The worker has requested to adjust the deadline for "${projectTitle}" to ${newDeadline}. Please review and approve.`
      },
      {
        userIds: [clientId],
        excludeUserId: workerId
      },
      projectId
    );
  }

  /**
   * C -> W: Client accepts adjustment (word count or deadline)
   */
  static async notifyAdjustmentAccepted(
    projectId: number, 
    workerId: string, 
    clientId: string, 
    projectTitle: string,
    adjustmentType: 'word_count' | 'deadline'
  ): Promise<void> {
    const adjustmentText = adjustmentType === 'word_count' ? 'word count' : 'deadline';
    
    await this.sendNotification(
      {
        title: '✅ Adjustment Approved',
        body: `Your ${adjustmentText} adjustment request for "${projectTitle}" has been approved. You can continue working on the project.`
      },
      {
        userIds: [workerId],
        excludeUserId: clientId
      },
      projectId
    );
  }

  /**
   * C -> W: Client rejects adjustment (project cancelled)
   */
  static async notifyAdjustmentRejected(
    projectId: number, 
    workerId: string, 
    clientId: string, 
    projectTitle: string,
    adjustmentType: 'word_count' | 'deadline'
  ): Promise<void> {
    const adjustmentText = adjustmentType === 'word_count' ? 'word count' : 'deadline';
    
    await this.sendNotification(
      {
        title: '❌ Adjustment Rejected',
        body: `Your ${adjustmentText} adjustment request for "${projectTitle}" has been rejected. The project has been cancelled.`
      },
      {
        userIds: [workerId],
        excludeUserId: clientId
      },
      projectId
    );

    // Also notify agents
    await this.sendNotification(
      {
        title: '🚫 Project Cancelled',
        body: `"${projectTitle}" has been cancelled due to rejected ${adjustmentText} adjustment.`
      },
      {
        roles: ['agent'],
        excludeUserId: clientId
      },
      projectId
    );
  }

  /**
   * C -> W: Client requests changes
   */
  static async notifyChangesRequested(
    projectId: number, 
    workerId: string, 
    clientId: string, 
    projectTitle: string
  ): Promise<void> {
    await this.sendNotification(
      {
        title: '🔄 Changes Requested',
        body: `The client has requested changes to "${projectTitle}". Please review the feedback and make the necessary modifications.`
      },
      {
        userIds: [workerId],
        excludeUserId: clientId
      },
      projectId
    );
  }

  /**
   * A -> All: Agent sets project to refund
   */
  static async notifyProjectRefund(
    projectId: number, 
    agentId: string, 
    projectTitle: string,
    clientId: string,
    workerId?: string
  ): Promise<void> {
    const userIds = [clientId];
    if (workerId) userIds.push(workerId);

    await this.sendNotification(
      {
        title: '💰 Refund Processed',
        body: `"${projectTitle}" has been set for refund processing. You will receive your refund shortly.`
      },
      {
        userIds,
        excludeUserId: agentId
      },
      projectId
    );
  }

  /**
   * A -> All: Agent marks project as completed
   */
  static async notifyProjectCompleted(
    projectId: number, 
    agentId: string, 
    projectTitle: string,
    clientId: string,
    workerId?: string
  ): Promise<void> {
    // Notify client
    await this.sendNotification(
      {
        title: '🎉 Project Completed',
        body: `"${projectTitle}" has been successfully completed! Thank you for choosing our services.`
      },
      {
        userIds: [clientId],
        excludeUserId: agentId
      },
      projectId
    );

    // Notify worker if exists
    if (workerId) {
      await this.sendNotification(
        {
          title: '🎉 Project Completed',
          body: `Great job! "${projectTitle}" has been marked as completed.`
        },
        {
          userIds: [workerId],
          excludeUserId: agentId
        },
        projectId
      );
    }
  }

  /**
   * Agent Broadcast: Send custom notification to selected roles
   */
  static async sendBroadcastNotification(
    title: string,
    body: string,
    targetRoles: UserRole[],
    agentId: string
  ): Promise<void> {
    await this.sendNotification(
      {
        title: `📢 ${title}`,
        body
      },
      {
        roles: targetRoles,
        excludeUserId: agentId
      }
    );
  }
}

export default WorkflowNotificationService;