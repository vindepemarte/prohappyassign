

import { projectsApi, filesApi } from './apiService';
import { sendNotification } from './notificationService';
import { PricingCalculator } from './pricingCalculator';
import type { NewProjectFormData, Project, ChangesFormData, ProjectStatus, ProjectWithDetails, PricingBreakdown, UrgencyLevel } from '../types';


// Removed unused PROJECT_COLUMNS constant

/**
 * Calculates the price based on word count using correct tiered pricing.
 * @param wordCount The number of words.
 * @returns The calculated price in GBP.
 */
export const calculatePrice = (wordCount: number): number => {
    return PricingCalculator.calculateBasePrice(wordCount);
};

/**
 * Calculates enhanced pricing with deadline charges using the correct pricing system.
 * @param wordCount The number of words.
 * @param deadline The deadline date.
 * @param requestDate The request date (defaults to current date).
 * @returns Complete pricing breakdown including deadline charges.
 */
export const calculateEnhancedPrice = (
    wordCount: number,
    deadline: Date,
    requestDate: Date = new Date()
): PricingBreakdown => {
    return PricingCalculator.calculateTotalPrice(wordCount, deadline, requestDate);
};

/**
 * A helper to safely fire and forget a notification without blocking the main flow.
 * @param promise A promise that sends a notification.
 */
const fireAndForgetNotification = (promise: Promise<any>) => {
    promise.catch(err => console.error("Failed to send notification:", err));
}

/**
 * Fetches the client and worker IDs for a given project.
 * @param projectId The ID of the project.
 * @returns An object containing the client and worker IDs.
 */
const getProjectParticipantIds = async (projectId: number): Promise<{ clientId: string | null, workerId: string | null }> => {
    try {
        const response = await projectsApi.getById(projectId);
        const project = response.data;
        return { clientId: project?.client_id || null, workerId: project?.worker_id || null };
    } catch (error) {
        console.error(`Error fetching participants for project ${projectId}:`, error);
        return { clientId: null, workerId: null };
    }
};


// File upload is now handled by the filesApi

/**
 * Submits a new project to the database.
 * @param data The new project form data.
 * @param userId The ID of the user submitting the request.
 */
export const createNewProject = async (data: NewProjectFormData, userId: string): Promise<void> => {
    // 1. Calculate enhanced price with deadline charges
    const deadlineDate = new Date(data.deadline);
    const pricingBreakdown = calculateEnhancedPrice(data.wordCount, deadlineDate);

    // 2. Generate unique order reference
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // Get last 2 digits of year
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    let orderReference = `PRO-${year}-${random}`;

    // 3. Insert project record to get an ID with retry logic for duplicate order reference
    const projectToInsert = {
        client_id: userId,
        title: data.title,
        initial_word_count: data.wordCount,
        deadline: data.deadline,
        description: data.guidance,
        cost_gbp: pricingBreakdown.totalPrice,
        deadline_charge: pricingBreakdown.deadlineCharge,
        urgency_level: pricingBreakdown.urgencyLevel,
        order_reference: orderReference,
        status: 'pending_payment_approval' as const,
    };

    let projectData: any;
    let insertAttempts = 0;
    const maxInsertAttempts = 3;

    while (insertAttempts < maxInsertAttempts) {
        try {
            const response = await projectsApi.create(projectToInsert);
            projectData = response.data;
            break;
        } catch (error) {
            // Check if it's a duplicate order reference error
            if (error.message?.includes('order_reference') || error.message?.includes('duplicate')) {
                insertAttempts++;
                console.warn(`Duplicate order reference detected: ${orderReference}. Generating new one... (attempt ${insertAttempts})`);

                if (insertAttempts >= maxInsertAttempts) {
                    throw new Error('Failed to generate unique order reference after multiple attempts. Please try again.');
                }

                // Generate a new order reference
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const timestamp = Date.now() % 1000;
                const randomSuffix = Math.floor(Math.random() * 100);
                orderReference = `PRO-${year}-${String(timestamp + randomSuffix).padStart(3, '0')}`;
                projectToInsert.order_reference = orderReference;

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 300));
                continue;
            } else {
                if (insertAttempts >= maxInsertAttempts - 1) {
                    console.error('Error inserting project:', error);
                    throw new Error('Failed to save your project. Please try again.');
                }
                insertAttempts++;
            }
        }
    }

    if (!projectData) {
        throw new Error('Failed to save your project. Please try again.');
    }

    const projectId = projectData.id;

    // 4. Files are uploaded in step 5 below

    // 5. Upload files using the new API
    if (data.files && data.files.length > 0) {
        try {
            // Convert File[] to FileList-like object
            const fileList = data.files as any;
            await filesApi.upload(projectId, fileList, 'initial_brief');
        } catch (error) {
            console.error('Error uploading project files:', error);
            throw new Error('Failed to save project files. Please try again.');
        }
    }

    // 6. Notify agents of new project submission
    try {
        await sendNotification({
            target: { role: 'agent' },
            payload: {
                title: 'New Project Submitted',
                body: `New project "${data.title}" has been submitted and needs assignment.`
            }
        });
    } catch (error) {
        console.error('Failed to send new project notification:', error);
    }
};

/**
 * Fetches all projects for a given client.
 * @param userId The ID of the client.
 * @returns A promise that resolves to an array of projects.
 */
export const getProjectsForUser = async (_userId: string): Promise<Project[]> => {
    try {
        const response = await projectsApi.getAll();
        return response.data || [];
    } catch (error) {
        console.error('Error fetching projects:', error);
        throw new Error('Could not load your projects.');
    }
};

/**
 * Submits a change request for a project.
 * @param data The change request form data.
 * @param userId The ID of the user submitting the request.
 */
export const submitChangeRequest = async (data: ChangesFormData, _userId: string): Promise<void> => {
    // 1. Add record to project_change_requests
    try {
        await projectsApi.submitChangeRequest(data.projectId, data.instructions);
    } catch (error) {
        throw new Error(`Failed to submit change request: ${error.message}`);
    }

    // 2. Upload any new files
    if (data.files.length > 0) {
        try {
            // Convert File[] to FileList-like object
            const fileList = data.files as any;
            await filesApi.upload(data.projectId, fileList, 'change_request');
        } catch (error) {
            throw new Error(`Failed to upload files for change request: ${error.message}`);
        }
    }

    // 3. Update project status
    try {
        await projectsApi.updateStatus(data.projectId, 'needs_changes');
    } catch (error) {
        throw new Error(`Failed to update project status: ${error.message}`);
    }

    // 4. Notify worker
    try {
        const projectResponse = await projectsApi.getById(data.projectId);
        const project = projectResponse.data;

        if (project.worker_id) {
            await sendNotification({
                target: { userIds: [project.worker_id] },
                payload: {
                    title: 'Change Request Submitted',
                    body: `Changes have been requested for project "${project.title}".`
                }
            });
        }
    } catch (notificationError) {
        console.error('Failed to send change request notification:', notificationError);
    }
};

/**
 * Fetches the download URL for a file.
 * @param fileId The ID of the file.
 * @returns The public URL of the file.
 */
export const getFileUrl = async (fileId: number): Promise<string> => {
    try {
        const response = await filesApi.getUrl(fileId);
        return response.data.url;
    } catch (error) {
        console.error('File URL error:', error);
        throw new Error(`Failed to get file URL: ${error.message}`);
    }
};

/**
 * Downloads a file as a Blob.
 * @param fileId The ID of the file.
 * @returns A promise that resolves to the file Blob.
 */
export const downloadFile = async (fileId: number): Promise<Blob> => {
    try {
        return await filesApi.download(fileId);
    } catch (error) {
        console.error('File download error:', error);
        throw new Error(`Failed to download file: ${error.message}`);
    }
};

// ===============================================
// ROLE-BASED DASHBOARD FUNCTIONS
// ===============================================

/**
 * Fetches all projects assigned to a specific worker.
 * @param workerId The ID of the worker.
 * @returns A promise that resolves to an array of projects.
 */
export const getProjectsForWorker = async (workerId: string): Promise<Project[]> => {
    try {
        const response = await projectsApi.getAll();
        // Filter for worker projects on frontend for now
        return (response.data || []).filter((p: any) => p.worker_id === workerId);
    } catch (error) {
        console.error('Error fetching worker projects:', error);
        throw new Error('Could not load assigned projects.');
    }
};

/**
 * Fetches all projects in the system (for agents).
 * @returns A promise that resolves to an array of all projects.
 */
export const getAllProjectsForAgent = async (): Promise<Project[]> => {
    try {
        const response = await projectsApi.getAll();
        return response.data || [];
    } catch (error) {
        console.error('Error fetching all projects for agent:', error);
        throw new Error('Could not load system projects.');
    }
};

/**
 * Updates the status of a specific project (for agents).
 * @param projectId The ID of the project to update.
 * @param status The new status for the project.
 * @param bypassValidation Optional parameter to bypass status validation (for agents only).
 */
export const updateProjectStatus = async (projectId: number, status: ProjectStatus, bypassValidation: boolean = false): Promise<void> => {
    console.log(`Updating project ${projectId} status to ${status}`);

    // Get current project status for validation
    try {
        const response = await projectsApi.getById(projectId);
        const currentProject = response.data;

        if (!currentProject) {
            throw new Error(`Project ${projectId} not found.`);
        }

        console.log(`Current status: ${currentProject.status}, New status: ${status}, Bypass validation: ${bypassValidation}`);

        // Simple status validation (bypassed for now)
        console.log(`Status transition: ${currentProject.status} -> ${status}`);

        await projectsApi.updateStatus(projectId, status);
    } catch (error) {
        console.error(`Error updating project ${projectId} status:`, error);
        throw new Error(`Failed to update project status: ${error.message}`);
    }

    console.log(`Successfully updated project ${projectId} status to ${status}`);

    // Send simple notification
    try {
        await sendNotification({
            target: { role: 'agent' },
            payload: {
                title: 'Project Status Updated',
                body: `Project #${projectId} status changed to ${status}.`
            }
        });
    } catch (error) {
        console.error('Failed to send status update notification:', error);
    }
};

// Workflow notifications removed for simplicity

/**
 * Processes a refund for a project (for agents).
 * Changes status from 'refund' to 'cancelled' and sends notifications.
 * @param projectId The ID of the project to process refund for.
 */
export const processRefund = async (projectId: number): Promise<void> => {
    // Get current project details for validation
    try {
        const response = await projectsApi.getById(projectId);
        const project = response.data;

        // Validate that project is in refund status
        if (project.status !== 'refund') {
            throw new Error('Project must be in "refund" status to process refund.');
        }

        // Update project status to cancelled
        await projectsApi.updateStatus(projectId, 'cancelled');

        // Note: Project notes functionality not implemented in API yet
        console.log(`Refund processed for project ${projectId}. Status changed from 'refund' to 'cancelled'.`);

        // Notify the client about the refund processing
        if (project.client_id) {
            fireAndForgetNotification(sendNotification({
                target: { userIds: [project.client_id] },
                payload: {
                    title: 'Refund Processed',
                    body: `Your refund for project "${project.title}" has been processed. The project has been cancelled.`
                }
            }));
        }

        // Notify other agents about the refund completion
        fireAndForgetNotification(sendNotification({
            target: { role: 'agent' },
            payload: {
                title: 'Refund Completed',
                body: `Refund for project #${projectId} has been processed and the project is now cancelled.`
            }
        }));
    } catch (error) {
        console.error(`Error processing refund for project ${projectId}:`, error);
        throw new Error('Failed to process refund.');
    }
};


/**
 * Fetches all users with the 'worker' role.
 * @returns A promise that resolves to an array of worker profiles.
 */
export const getAllWorkers = async () => {
    try {
        const response = await projectsApi.getWorkers();
        return response.data || [];
    } catch (error) {
        console.error('Error fetching workers:', error);
        throw new Error('Could not load workers.');
    }
};

/**
 * Assigns a worker to a project and updates its status.
 * @param projectId The ID of the project.
 * @param workerId The ID of the worker to assign.
 */
export const assignWorkerToProject = async (projectId: number, workerId: string): Promise<void> => {
    try {
        await projectsApi.assignWorker(projectId, workerId);

        // Notify the assigned worker
        try {
            await sendNotification({
                target: { userIds: [workerId] },
                payload: {
                    title: 'New Assignment',
                    body: `You have been assigned to a new project.`
                }
            });
        } catch (notificationError) {
            console.warn('Failed to send assignment notification:', notificationError);
        }
    } catch (error) {
        console.error(`Error assigning worker to project ${projectId}:`, error);
        throw new Error('Failed to assign worker.');
    }
};

/**
 * Fetches a single project with its associated files and change requests.
 * @param projectId The ID of the project to fetch.
 * @returns A promise that resolves to the detailed project data.
 */
export const getProjectDetails = async (projectId: number): Promise<ProjectWithDetails> => {
    try {
        const response = await projectsApi.getById(projectId);
        return response.data;
    } catch (error) {
        console.error('Get project details error:', error);
        throw new Error('Could not find project.');
    }
};

/**
 * Allows a worker to submit the final work for a project.
 * @param projectId The ID of the project.
 * @param files The final files to upload.
 * @param workerId The ID of the worker submitting.
 */
export const submitFinalWork = async (projectId: number, files: File[], _workerId: string): Promise<void> => {
    if (files.length === 0) {
        throw new Error('You must upload at least one file.');
    }
    // 1. Upload files using the new API
    if (files && files.length > 0) {
        try {
            // Convert File[] to FileList-like object
            const fileList = files as any;
            await filesApi.upload(projectId, fileList, 'final_delivery');
        } catch (error) {
            throw new Error(`Failed to save final work files: ${error.message}`);
        }
    }

    // 2. Update project status
    await updateProjectStatus(projectId, 'pending_final_approval');

    // 3. Notify the client
    const { clientId } = await getProjectParticipantIds(projectId);
    if (clientId) {
        fireAndForgetNotification(sendNotification({
            target: { userIds: [clientId] },
            payload: {
                title: 'Final Work Submitted',
                body: `The final work for your project #${projectId} has been submitted for your approval.`
            }
        }));
    }
};

/**
 * Allows a worker to request a word count change.
 * @param projectId The ID of the project.
 * @param newWordCount The new proposed word count.
 */
export const requestWordCountChange = async (projectId: number, newWordCount: number): Promise<void> => {
    try {
        const response = await fetch(`/api/projects/${projectId}/request-word-count-change`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newWordCount })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to request word count change');
        }

        console.log('Word count change requested successfully');
    } catch (error) {
        console.error('Error requesting word count change:', error);
        throw new Error('Failed to request word count change');
    }
};

/**
 * Allows a worker to request a deadline change.
 * @param projectId The ID of the project.
 * @param newDeadline The new proposed deadline.
 */
export const requestDeadlineChange = async (projectId: number, newDeadline: Date): Promise<void> => {
    try {
        const response = await fetch(`/api/projects/${projectId}/request-deadline-change`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newDeadline: newDeadline.toISOString() })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to request deadline change');
        }

        console.log('Deadline change requested successfully');
    } catch (error) {
        console.error('Error requesting deadline change:', error);
        throw new Error('Failed to request deadline change');
    }
};

/**
 * Approves a new quote proposed by a worker.
 * @param projectId The ID of the project.
 */
export const approveQuoteChange = async (projectId: number): Promise<void> => {
    try {
        // Get current project details
        const response = await projectsApi.getById(projectId);
        const project = response.data;

        // Update project status to in_progress
        await updateProjectStatus(projectId, 'in_progress');

        // Notify the worker that their quote was approved
        if (project.worker_id) {
            await sendNotification({
                target: { userIds: [project.worker_id] },
                payload: {
                    title: 'Quote Approved',
                    body: `Your quote change for project "${project.title}" has been approved. You can continue working.`
                }
            });
        }

        // Notify agents
        await sendNotification({
            target: { role: 'agent' },
            payload: {
                title: 'Quote Approved',
                body: `Quote change for project "${project.title}" has been approved by the client.`
            }
        });
    } catch (error) {
        console.error('Error approving quote change:', error);
        throw new Error('Failed to approve quote change');
    }
};

/**
 * Rejects a new quote and reverts to original values.
 */
export const rejectQuoteChange = async (projectId: number, originalWordCount: number): Promise<void> => {
    try {
        // Get current project details
        const response = await projectsApi.getById(projectId);
        const project = response.data;

        // Calculate original pricing
        const originalDeadline = new Date(project.deadline);
        const originalPricing = calculateEnhancedPrice(originalWordCount, originalDeadline);

        // Revert project to original values
        const revertResponse = await fetch(`/api/projects/${projectId}/revert-quote`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                originalWordCount,
                originalCost: originalPricing.totalPrice,
                originalDeadlineCharge: originalPricing.deadlineCharge,
                originalUrgencyLevel: originalPricing.urgencyLevel
            })
        });

        if (!revertResponse.ok) {
            throw new Error('Failed to revert quote changes');
        }

        // Notify the worker that their quote was rejected
        if (project.worker_id) {
            await sendNotification({
                target: { userIds: [project.worker_id] },
                payload: {
                    title: 'Quote Rejected',
                    body: `Your quote change for project "${project.title}" has been rejected. The project has been reverted to original specifications.`
                }
            });
        }

        // Notify agents
        await sendNotification({
            target: { role: 'agent' },
            payload: {
                title: 'Quote Rejected',
                body: `Quote change for project "${project.title}" has been rejected by the client and reverted.`
            }
        });
    } catch (error) {
        console.error('Error rejecting quote change:', error);
        throw new Error('Failed to reject quote change');
    }
};

/**
 * Rejects a deadline change and reverts to original deadline.
 */
export const rejectDeadlineChange = async (projectId: number, originalDeadline: Date): Promise<void> => {
    try {
        // Get current project details
        const response = await projectsApi.getById(projectId);
        const project = response.data;

        // Calculate original pricing with original deadline
        const wordCount = project.adjusted_word_count || project.initial_word_count;
        const originalPricing = calculateEnhancedPrice(wordCount, originalDeadline);

        // Revert project to original deadline and pricing
        const revertResponse = await fetch(`/api/projects/${projectId}/revert-deadline`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                originalDeadline: originalDeadline.toISOString(),
                originalCost: originalPricing.totalPrice,
                originalDeadlineCharge: originalPricing.deadlineCharge,
                originalUrgencyLevel: originalPricing.urgencyLevel
            })
        });

        if (!revertResponse.ok) {
            throw new Error('Failed to revert deadline changes');
        }

        // Notify the worker that their deadline change was rejected
        if (project.worker_id) {
            await sendNotification({
                target: { userIds: [project.worker_id] },
                payload: {
                    title: 'Deadline Change Rejected',
                    body: `Your deadline change request for project "${project.title}" has been rejected. The original deadline has been restored.`
                }
            });
        }

        // Notify agents
        await sendNotification({
            target: { role: 'agent' },
            payload: {
                title: 'Deadline Change Rejected',
                body: `Deadline change for project "${project.title}" has been rejected by the client and reverted.`
            }
        });
    } catch (error) {
        console.error('Error rejecting deadline change:', error);
        throw new Error('Failed to reject deadline change');
    }
};

/**
 * Allows a worker to cancel a project (placeholder).
 */
export const cancelProject = async (projectId: number, reason: string, _workerId?: string): Promise<void> => {
    console.log('Project cancellation requested:', projectId, reason);
    await updateProjectStatus(projectId, 'cancelled');
};

/**
 * Allows a worker to request a deadline extension (placeholder).
 */
export const requestDeadlineExtension = async (
    projectId: number,
    requestedDeadline: Date,
    reason: string,
    _workerId?: string
): Promise<void> => {
    console.log('Deadline extension requested:', projectId, requestedDeadline, reason);
    // Implementation would go here
};