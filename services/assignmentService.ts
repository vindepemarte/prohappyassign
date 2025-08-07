

import { supabase } from './supabase';
import type { NewProjectFormData, Project, ChangesFormData, Database, ProjectStatus, Profile, ProjectWithDetails, PricingBreakdown } from '../types';
import { isValidStatusTransition } from '../utils/statusValidation';
import { PRICING_TABLE } from '../constants';
import { sendNotification } from './notificationService';
import { PricingCalculator } from './pricingCalculator';
import { OrderReferenceGenerator } from './orderReferenceGenerator';
import WorkflowNotificationService from './workflowNotificationService';
import { queryOptimizer } from '../utils/queryOptimizer';
import { projectCache, userCache } from '../utils/cacheManager';

const PROJECT_COLUMNS = 'id, client_id, worker_id, agent_id, title, description, status, initial_word_count, adjusted_word_count, cost_gbp, deadline, order_reference, deadline_charge, urgency_level, adjustment_type, created_at, updated_at';

/**
 * Calculates the price based on word count from the pricing table (legacy function).
 * @param wordCount The number of words.
 * @returns The calculated price in GBP.
 */
export const calculatePrice = (wordCount: number): number => {
    if (wordCount <= 0) return 0;

    // Defensive check to ensure PRICING_TABLE is available
    if (!PRICING_TABLE || !Array.isArray(PRICING_TABLE) || PRICING_TABLE.length === 0) {
        console.error('PRICING_TABLE is not available or empty');
        return 0;
    }

    const tier = PRICING_TABLE.find(p => wordCount <= p.maxWords);
    return tier ? tier.price : PRICING_TABLE[PRICING_TABLE.length - 1].price; // Default to max price if over
};

/**
 * Calculates enhanced pricing with deadline charges.
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
    const { data, error } = await supabase
        .from('projects')
        .select('client_id, worker_id')
        .eq('id', projectId)
        .single();
    
    if (error) {
        console.error(`Error fetching participants for project ${projectId}:`, error);
        return { clientId: null, workerId: null };
    }

    return { clientId: data.client_id, workerId: data.worker_id };
};


/**
 * Uploads files to Supabase storage for a specific project.
 * @param files The files to upload.
 * @param userId The uploader's ID.
 * @param projectId The project's ID.
 * @returns A promise that resolves with an array of file paths.
 */
const uploadFiles = async (files: File[], userId: string, projectId: number): Promise<{name: string, path: string}[]> => {
    const uploadPromises = files.map(async (file) => {
        const filePath = `${userId}/${projectId}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage
            .from('assignments') // This is the bucket name
            .upload(filePath, file);

        if (error) {
            throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }
        return { name: file.name, path: filePath };
    });

    return Promise.all(uploadPromises);
};

/**
 * Submits a new project to the database.
 * @param data The new project form data.
 * @param userId The ID of the user submitting the request.
 */
export const createNewProject = async (data: NewProjectFormData, userId: string): Promise<void> => {
    // 1. Calculate enhanced price with deadline charges
    const deadlineDate = new Date(data.deadline);
    const pricingBreakdown = calculateEnhancedPrice(data.wordCount, deadlineDate);

    // 2. Generate unique order reference with retry logic
    let orderReference: string;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
        try {
            orderReference = await OrderReferenceGenerator.generate();
            break;
        } catch (error) {
            attempts++;
            console.error(`Order reference generation attempt ${attempts} failed:`, error);
            if (attempts >= maxAttempts) {
                // Fallback to timestamp-based reference
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const timestamp = Date.now() % 1000000;
                orderReference = `ORD-${year}-${month}-${String(timestamp).padStart(6, '0')}`;
                console.warn(`Using fallback order reference: ${orderReference}`);
                break;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 200 * attempts));
        }
    }

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
        order_reference: orderReference!,
        status: 'pending_payment_approval' as const,
    };

    let projectData;
    let insertAttempts = 0;
    const maxInsertAttempts = 3;
    
    while (insertAttempts < maxInsertAttempts) {
        try {
            const { data, error } = await supabase
                .from('projects')
                .insert([projectToInsert])
                .select()
                .single();

            if (error) {
                // Check if it's a duplicate order reference error
                if (error.code === '23505' && error.message?.includes('order_reference')) {
                    insertAttempts++;
                    console.warn(`Duplicate order reference detected: ${orderReference}. Generating new one... (attempt ${insertAttempts})`);
                    
                    if (insertAttempts >= maxInsertAttempts) {
                        throw new Error('Failed to generate unique order reference after multiple attempts. Please try again.');
                    }
                    
                    // Generate a new order reference
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const timestamp = Date.now() % 1000000;
                    const randomSuffix = Math.floor(Math.random() * 100);
                    orderReference = `ORD-${year}-${month}-${String(timestamp + randomSuffix).padStart(6, '0')}`;
                    projectToInsert.order_reference = orderReference;
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 300));
                    continue;
                } else {
                    throw error;
                }
            }

            projectData = data;
            break;
        } catch (error) {
            if (insertAttempts >= maxInsertAttempts - 1) {
                console.error('Error inserting project:', error);
                throw new Error('Failed to save your project. Please try again.');
            }
            insertAttempts++;
        }
    }

    if (!projectData) {
        throw new Error('Failed to save your project. Please try again.');
    }
    
    const projectId = projectData.id;

    // 4. Upload files
    const uploadedFiles = await uploadFiles(data.files, userId, projectId);

    // 5. Insert file records into project_files
    const fileRecords = uploadedFiles.map(file => ({
        project_id: projectId,
        uploader_id: userId,
        file_name: file.name,
        file_path: file.path,
        purpose: 'initial_brief' as const,
    }));
    
    const { error: fileError } = await supabase.from('project_files').insert(fileRecords);
    
    if(fileError) {
        console.error('Error inserting project files:', fileError);
        // In a real app, you might want to delete the project record and stored files here.
        throw new Error('Failed to save project files. Please try again.');
    }

    // 6. Notify agents of new project submission (C -> A)
    try {
        await WorkflowNotificationService.notifyNewProjectSubmission(
            projectId,
            userId,
            data.title
        );
    } catch (error) {
        console.error('Failed to send new project notification:', error);
    }
};

/**
 * Fetches all projects for a given client.
 * @param userId The ID of the client.
 * @returns A promise that resolves to an array of projects.
 */
export const getProjectsForUser = async (userId: string): Promise<Project[]> => {
    const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_COLUMNS)
        .eq('client_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching projects:', error);
        throw new Error('Could not load your projects.');
    }

    return data || [];
};

/**
 * Submits a change request for a project.
 * @param data The change request form data.
 * @param userId The ID of the user submitting the request.
 */
export const submitChangeRequest = async (data: ChangesFormData, userId: string): Promise<void> => {
    // 1. Add record to project_change_requests
    const changeRequestToInsert = {
        project_id: data.projectId,
        instructions: data.instructions,
    };
    const { error: requestError } = await supabase.from('project_change_requests').insert([changeRequestToInsert]);

    if (requestError) {
        throw new Error(`Failed to submit change request: ${requestError.message}`);
    }

    // 2. Upload any new files
    if (data.files.length > 0) {
        const uploadedFiles = await uploadFiles(data.files, userId, data.projectId);
        const fileRecords = uploadedFiles.map(file => ({
            project_id: data.projectId,
            uploader_id: userId,
            file_name: file.name,
            file_path: file.path,
            purpose: 'change_request' as const,
        }));
        const { error: fileError } = await supabase.from('project_files').insert(fileRecords);
        if (fileError) {
            throw new Error(`Failed to upload files for change request: ${fileError.message}`);
        }
    }
    
    // 3. Update project status
    const projectUpdate = { status: 'needs_changes' as const };
    const { error: statusError } = await supabase
        .from('projects')
        .update(projectUpdate)
        .eq('id', data.projectId);
        
    if (statusError) {
        throw new Error(`Failed to update project status: ${statusError.message}`);
    }

    // 4. Notify worker using WorkflowNotificationService
    const { workerId } = await getProjectParticipantIds(data.projectId);
    if (workerId) {
        try {
            const { data: project } = await supabase
                .from('projects')
                .select('title')
                .eq('id', data.projectId)
                .single();

            if (project) {
                await WorkflowNotificationService.notifyChangesRequested(
                    data.projectId,
                    workerId,
                    userId,
                    project.title
                );
            }
        } catch (notificationError) {
            console.error('Failed to send change request notification:', notificationError);
        }
    }
};

/**
 * Fetches the download URL for a file in Supabase storage.
 * @param filePath The path of the file in the bucket.
 * @returns The public URL of the file.
 */
export const getFileUrl = (filePath: string): string => {
    const { data } = supabase.storage.from('assignments').getPublicUrl(filePath);
    return data.publicUrl;
};

/**
 * Downloads a file from Supabase storage as a Blob.
 * @param filePath The path of the file in the bucket.
 * @returns A promise that resolves to the file Blob.
 */
export const downloadFile = async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage.from('assignments').download(filePath);
    if (error) {
        console.error('File download error:', error);
        throw new Error(`Failed to download file: ${error.message}`);
    }
    if (!data) {
        throw new Error('File not found or empty.');
    }
    return data;
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
        const result = await queryOptimizer.getProjectsForWorker(workerId, {
            useCache: true,
            pageSize: 100, // Get all projects for worker
            orderBy: 'created_at',
            orderDirection: 'desc'
        });
        
        return result.data;
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
        const result = await queryOptimizer.getProjectsForAgent({
            useCache: true,
            pageSize: 200, // Get more projects for agent view
            orderBy: 'created_at',
            orderDirection: 'desc'
        });
        
        return result.data;
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
    const { data: currentProject, error: fetchError } = await supabase
        .from('projects')
        .select('status')
        .eq('id', projectId)
        .single();

    if (fetchError) {
        console.error(`Error fetching project ${projectId} for status validation:`, fetchError);
        throw new Error(`Failed to validate status transition: ${fetchError.message}`);
    }

    if (!currentProject) {
        throw new Error(`Project ${projectId} not found.`);
    }

    console.log(`Current status: ${currentProject.status}, New status: ${status}, Bypass validation: ${bypassValidation}`);

    // Validate status transition (unless bypassed)
    if (!bypassValidation && !isValidStatusTransition(currentProject.status, status)) {
        const errorMsg = `Invalid status transition from '${currentProject.status}' to '${status}'.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    const { error } = await supabase
        .from('projects')
        .update({ status: status })
        .eq('id', projectId);

    if (error) {
        console.error(`Error updating project ${projectId} status:`, error);
        throw new Error(`Failed to update project status: ${error.message}`);
    }

    console.log(`Successfully updated project ${projectId} status to ${status}`);

    // Invalidate project caches
    projectCache.clear();
    queryOptimizer.invalidateCache('projects');
    
    // Send workflow notifications based on status change
    await sendWorkflowNotifications(projectId, currentProject.status, status);
};

/**
 * Send appropriate workflow notifications based on status change
 */
const sendWorkflowNotifications = async (
    projectId: number, 
    oldStatus: ProjectStatus, 
    newStatus: ProjectStatus
): Promise<void> => {
    try {
        // Get project details for notifications
        const { data: project } = await supabase
            .from('projects')
            .select('title, client_id, worker_id, agent_id, adjustment_type')
            .eq('id', projectId)
            .single();

        if (!project) return;

        const { title, client_id, worker_id, agent_id, adjustment_type } = project;

        // Handle different status transitions
        switch (newStatus) {
            case 'pending_final_approval':
                // W -> A: Worker completed project
                if (worker_id) {
                    await WorkflowNotificationService.notifyProjectCompletedByWorker(
                        projectId, worker_id, title
                    );
                }
                break;

            case 'in_progress':
                // C -> W: Client accepted adjustment
                if (oldStatus === 'pending_quote_approval' && worker_id && adjustment_type) {
                    await WorkflowNotificationService.notifyAdjustmentAccepted(
                        projectId, worker_id, client_id, title, adjustment_type
                    );
                }
                break;

            case 'cancelled':
                // C -> W: Client rejected adjustment
                if (oldStatus === 'pending_quote_approval' && worker_id && adjustment_type) {
                    await WorkflowNotificationService.notifyAdjustmentRejected(
                        projectId, worker_id, client_id, title, adjustment_type
                    );
                }
                break;

            case 'needs_changes':
                // C -> W: Client requested changes
                if (worker_id) {
                    await WorkflowNotificationService.notifyChangesRequested(
                        projectId, worker_id, client_id, title
                    );
                }
                break;

            case 'refund':
                // A -> All: Agent set refund
                if (agent_id) {
                    await WorkflowNotificationService.notifyProjectRefund(
                        projectId, agent_id, title, client_id, worker_id
                    );
                }
                break;

            case 'completed':
                // A -> All: Agent marked as completed
                if (agent_id) {
                    await WorkflowNotificationService.notifyProjectCompleted(
                        projectId, agent_id, title, client_id, worker_id
                    );
                }
                break;
        }
    } catch (error) {
        console.error('Error sending workflow notifications:', error);
        // Don't fail the status update if notifications fail
    }
};

/**
 * Processes a refund for a project (for agents).
 * Changes status from 'refund' to 'cancelled' and sends notifications.
 * @param projectId The ID of the project to process refund for.
 */
export const processRefund = async (projectId: number): Promise<void> => {
    // Get current project details for validation
    const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('status, client_id, title')
        .eq('id', projectId)
        .single();

    if (fetchError) {
        console.error(`Error fetching project ${projectId} for refund processing:`, fetchError);
        throw new Error('Failed to fetch project details.');
    }

    // Validate that project is in refund status
    if (project.status !== 'refund') {
        throw new Error('Project must be in "refund" status to process refund.');
    }

    // Update project status to cancelled
    const { error: updateError } = await supabase
        .from('projects')
        .update({ status: 'cancelled' as const })
        .eq('id', projectId);

    if (updateError) {
        console.error(`Error processing refund for project ${projectId}:`, updateError);
        throw new Error('Failed to process refund.');
    }

    // Add a note about the refund processing
    const { error: noteError } = await supabase
        .from('project_notes')
        .insert([{
            project_id: projectId,
            author_id: 'system', // System-generated note
            note: `Refund processed by agent. Project status changed from 'refund' to 'cancelled'.`
        }]);

    if (noteError) {
        console.error(`Error adding refund processing note for project ${projectId}:`, noteError);
        // Don't throw here as the main refund processing succeeded
    }

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
};


/**
 * Fetches all users with the 'worker' role.
 * @returns A promise that resolves to an array of worker profiles.
 */
export const getAllWorkers = async (): Promise<Profile[]> => {
    const cacheKey = 'all-workers';
    
    // Try cache first
    const cached = userCache.get<Profile[]>(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'worker')
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching workers:', error);
            throw new Error('Could not load workers.');
        }

        const workers = data || [];
        
        // Cache the result for 10 minutes
        userCache.set(cacheKey, workers, 10 * 60 * 1000);
        
        return workers;
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
    const { error } = await supabase
        .from('projects')
        .update({ worker_id: workerId, status: 'in_progress' })
        .eq('id', projectId);

    if (error) {
        console.error(`Error assigning worker to project ${projectId}:`, error);
        throw new Error('Failed to assign worker.');
    }

    // Invalidate project caches
    projectCache.clear();
    queryOptimizer.invalidateCache('projects');
    
    // Get project details for notification
    const { data: project } = await supabase
        .from('projects')
        .select('title, agent_id')
        .eq('id', projectId)
        .single();

    // Notify the assigned worker (A -> W)
    if (project) {
        try {
            await WorkflowNotificationService.notifyProjectAssignedToWorker(
                projectId,
                workerId,
                project.agent_id || '',
                project.title
            );
        } catch (notificationError) {
            console.warn('Failed to send assignment notification:', notificationError);
        }
    }
};

/**
 * Fetches a single project with its associated files and change requests.
 * @param projectId The ID of the project to fetch.
 * @returns A promise that resolves to the detailed project data.
 */
export const getProjectDetails = async (projectId: number): Promise<ProjectWithDetails> => {
    const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(PROJECT_COLUMNS)
        .eq('id', projectId)
        .single();

    if (projectError || !projectData) {
        throw new Error('Could not find project.');
    }

    const { data: filesData, error: filesError } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

    if (filesError) {
        throw new Error('Could not fetch project files.');
    }

    const { data: changesData, error: changesError } = await supabase
        .from('project_change_requests')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (changesError) {
        throw new Error('Could not fetch change requests.');
    }

    // Fetch deadline extension requests
    const { data: extensionsData, error: extensionsError } = await supabase
        .from('deadline_extension_requests')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (extensionsError) {
        console.error('Could not fetch deadline extension requests:', extensionsError);
        // Don't throw here, just log the error
    }

    return {
        ...projectData,
        project_files: filesData || [],
        project_change_requests: changesData || [],
        deadline_extension_requests: extensionsData || [],
    };
};

/**
 * Allows a worker to submit the final work for a project.
 * @param projectId The ID of the project.
 * @param files The final files to upload.
 * @param workerId The ID of the worker submitting.
 */
export const submitFinalWork = async (projectId: number, files: File[], workerId: string): Promise<void> => {
    if (files.length === 0) {
        throw new Error('You must upload at least one file.');
    }
    // 1. Upload files
    const uploadedFiles = await uploadFiles(files, workerId, projectId);
    const fileRecords = uploadedFiles.map(file => ({
        project_id: projectId,
        uploader_id: workerId,
        file_name: file.name,
        file_path: file.path,
        purpose: 'final_delivery' as const,
    }));
    const { error: fileError } = await supabase.from('project_files').insert(fileRecords);
    if (fileError) {
        throw new Error(`Failed to save final work files: ${fileError.message}`);
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
 * Allows a worker to request a word count change, which triggers a re-quote.
 * @param projectId The ID of the project.
 * @param newWordCount The new proposed word count.
 */
export const requestWordCountChange = async (projectId: number, newWordCount: number): Promise<void> => {
    if (newWordCount <= 0) {
        throw new Error('Word count must be a positive number.');
    }
    
    // 1. Get current project to maintain deadline
    const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('deadline')
        .eq('id', projectId)
        .single();
    
    if (fetchError || !projectData) {
        throw new Error('Could not fetch project details.');
    }
    
    // 2. Calculate new price with deadline charges
    const deadlineDate = new Date(projectData.deadline);
    const pricingBreakdown = calculateEnhancedPrice(newWordCount, deadlineDate);

    // 3. Update project with new word count, price, and status
    console.log(`Updating project ${projectId} status to 'pending_quote_approval' for word count change`);
    
    const { error } = await supabase
        .from('projects')
        .update({
            adjusted_word_count: newWordCount,
            cost_gbp: pricingBreakdown.totalPrice,
            deadline_charge: pricingBreakdown.deadlineCharge,
            urgency_level: pricingBreakdown.urgencyLevel,
            status: 'pending_quote_approval',
            adjustment_type: 'word_count'
        })
        .eq('id', projectId);
    
    if (error) {
        console.error(`Error updating project ${projectId} for word count change:`, error);
        throw new Error(`Failed to request word count change: ${error.message}`);
    }

    console.log(`Successfully updated project ${projectId} status to 'pending_quote_approval'`);

    // Clear project caches to ensure fresh data
    projectCache.clear();
    queryOptimizer.invalidateCache('projects');

    // 4. Notify agents and client using WorkflowNotificationService
    try {
        const { data: project } = await supabase
            .from('projects')
            .select('title, client_id')
            .eq('id', projectId)
            .single();

        if (project) {
            await WorkflowNotificationService.notifyWordCountAdjustmentRequest(
                projectId,
                project.client_id,
                '', // workerId will be filled by the service
                project.title,
                newWordCount
            );
        }
    } catch (notificationError) {
        console.error('Failed to send word count adjustment notification:', notificationError);
    }
};

/**
 * Allows a worker to request a deadline change, which triggers a re-quote.
 * @param projectId The ID of the project.
 * @param newDeadline The new proposed deadline.
 */
export const requestDeadlineChange = async (projectId: number, newDeadline: Date): Promise<void> => {
    if (newDeadline <= new Date()) {
        throw new Error('Deadline must be in the future.');
    }
    
    // 1. Get current project to maintain word count
    const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('initial_word_count, adjusted_word_count')
        .eq('id', projectId)
        .single();
    
    if (fetchError || !projectData) {
        throw new Error('Could not fetch project details.');
    }
    
    // 2. Calculate new price with new deadline charges
    const currentWordCount = projectData.adjusted_word_count || projectData.initial_word_count;
    const pricingBreakdown = calculateEnhancedPrice(currentWordCount, newDeadline);

    // 3. Update project with new deadline, price, and status
    console.log(`Updating project ${projectId} status to 'pending_quote_approval' for deadline change`);
    
    const { error } = await supabase
        .from('projects')
        .update({
            deadline: newDeadline.toISOString(),
            cost_gbp: pricingBreakdown.totalPrice,
            deadline_charge: pricingBreakdown.deadlineCharge,
            urgency_level: pricingBreakdown.urgencyLevel,
            status: 'pending_quote_approval',
            adjustment_type: 'deadline'
        })
        .eq('id', projectId);
    
    if (error) {
        console.error(`Error updating project ${projectId} for deadline change:`, error);
        throw new Error(`Failed to request deadline change: ${error.message}`);
    }

    console.log(`Successfully updated project ${projectId} status to 'pending_quote_approval'`);

    // Clear project caches to ensure fresh data
    projectCache.clear();
    queryOptimizer.invalidateCache('projects');

    // 4. Notify agents and client using WorkflowNotificationService
    try {
        const { data: project } = await supabase
            .from('projects')
            .select('title, client_id')
            .eq('id', projectId)
            .single();

        if (project) {
            await WorkflowNotificationService.notifyDeadlineAdjustmentRequest(
                projectId,
                project.client_id,
                '', // workerId will be filled by the service
                project.title,
                newDeadline.toLocaleDateString()
            );
        }
    } catch (notificationError) {
        console.error('Failed to send deadline adjustment notification:', notificationError);
    }
};

/**
 * Approves a new quote proposed by a worker.
 * @param projectId The ID of the project.
 */
export const approveQuoteChange = async (projectId: number): Promise<void> => {
    const { error } = await supabase
        .from('projects')
        .update({ 
            status: 'in_progress',
            adjustment_type: null
        })
        .eq('id', projectId);
    
    if (error) {
        throw new Error(`Failed to approve quote: ${error.message}`);
    }
    
    // Notify the worker
    const { workerId } = await getProjectParticipantIds(projectId);
    if (workerId) {
        fireAndForgetNotification(sendNotification({
            target: { userIds: [workerId] },
            payload: {
                title: 'Quote Change Approved',
                body: `Your new quote for project #${projectId} has been approved.`
            }
        }));
    }
};

/**
 * Rejects a new quote, reverting to the original word count and cost.
 * @param projectId The ID of the project.
 * @param originalWordCount The original word count to revert to.
 */
export const rejectQuoteChange = async (projectId: number, originalWordCount: number): Promise<void> => {
    // 1. Get current project to maintain deadline
    const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('deadline')
        .eq('id', projectId)
        .single();
    
    if (fetchError || !projectData) {
        throw new Error('Could not fetch project details.');
    }
    
    // 2. Calculate original cost with deadline charges
    const deadlineDate = new Date(projectData.deadline);
    const originalPricingBreakdown = calculateEnhancedPrice(originalWordCount, deadlineDate);

    const { error } = await supabase
        .from('projects')
        .update({
            status: 'in_progress',
            adjusted_word_count: null,
            cost_gbp: originalPricingBreakdown.totalPrice,
            deadline_charge: originalPricingBreakdown.deadlineCharge,
            urgency_level: originalPricingBreakdown.urgencyLevel,
            adjustment_type: null
        })
        .eq('id', projectId);
    
    if (error) {
        throw new Error(`Failed to reject quote: ${error.message}`);
    }

    // Notify the worker
    const { workerId } = await getProjectParticipantIds(projectId);
    if (workerId) {
        fireAndForgetNotification(sendNotification({
            target: { userIds: [workerId] },
            payload: {
                title: 'Quote Change Rejected',
                body: `Your new quote for project #${projectId} was rejected. The project has reverted to its original scope.`
            }
        }));
    }
};

/**
 * Rejects a deadline change, reverting to the original deadline.
 * @param projectId The ID of the project.
 * @param originalDeadline The original deadline to revert to.
 */
export const rejectDeadlineChange = async (projectId: number, originalDeadline: Date): Promise<void> => {
    // 1. Get current project to maintain word count
    const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('initial_word_count, adjusted_word_count')
        .eq('id', projectId)
        .single();
    
    if (fetchError || !projectData) {
        throw new Error('Could not fetch project details.');
    }
    
    // 2. Calculate original cost with original deadline charges
    const currentWordCount = projectData.adjusted_word_count || projectData.initial_word_count;
    const originalPricingBreakdown = calculateEnhancedPrice(currentWordCount, originalDeadline);

    const { error } = await supabase
        .from('projects')
        .update({
            status: 'in_progress',
            deadline: originalDeadline.toISOString(),
            cost_gbp: originalPricingBreakdown.totalPrice,
            deadline_charge: originalPricingBreakdown.deadlineCharge,
            urgency_level: originalPricingBreakdown.urgencyLevel,
            adjustment_type: null
        })
        .eq('id', projectId);
    
    if (error) {
        throw new Error(`Failed to reject deadline change: ${error.message}`);
    }

    // Notify the worker
    const { workerId } = await getProjectParticipantIds(projectId);
    if (workerId) {
        fireAndForgetNotification(sendNotification({
            target: { userIds: [workerId] },
            payload: {
                title: 'Deadline Change Rejected',
                body: `Your deadline change request for project #${projectId} was rejected. The project has reverted to its original deadline.`
            }
        }));
    }
};

/**
 * Allows a worker to cancel a project, setting its status to 'refund'.
 * @param projectId The ID of the project to cancel.
 * @param reason The reason for cancellation.
 * @param workerId The ID of the worker cancelling the project.
 */
export const cancelProject = async (projectId: number, reason: string, workerId: string): Promise<void> => {
    if (!reason.trim()) {
        throw new Error('A reason for cancellation is required.');
    }

    // 1. Update project status to 'refund'
    const { error: updateError } = await supabase
        .from('projects')
        .update({ 
            status: 'refund' as const,
            // Store cancellation reason in description or a note
        })
        .eq('id', projectId)
        .eq('worker_id', workerId); // Ensure only the assigned worker can cancel

    if (updateError) {
        console.error(`Error cancelling project ${projectId}:`, updateError);
        throw new Error('Failed to cancel project. Please try again.');
    }

    // 2. Add a note about the cancellation
    const { error: noteError } = await supabase
        .from('project_notes')
        .insert([{
            project_id: projectId,
            author_id: workerId,
            note: `Project cancelled by worker. Reason: ${reason}`
        }]);

    if (noteError) {
        console.error(`Error adding cancellation note for project ${projectId}:`, noteError);
        // Don't throw here as the main cancellation succeeded
    }

    // 3. Notify agents about the cancellation
    fireAndForgetNotification(sendNotification({
        target: { role: 'agent' },
        payload: {
            title: 'Project Cancelled',
            body: `Project #${projectId} has been cancelled by the worker and requires refund processing.`
        }
    }));

    // 4. Notify the client about the cancellation
    const { clientId } = await getProjectParticipantIds(projectId);
    if (clientId) {
        fireAndForgetNotification(sendNotification({
            target: { userIds: [clientId] },
            payload: {
                title: 'Project Cancelled',
                body: `Your project #${projectId} has been cancelled. A refund will be processed shortly.`
            }
        }));
    }
};

/**
 * Allows a worker to request a deadline extension for a project.
 * @param projectId The ID of the project.
 * @param requestedDeadline The new requested deadline.
 * @param reason The reason for the extension request.
 * @param workerId The ID of the worker requesting the extension.
 */
export const requestDeadlineExtension = async (
    projectId: number, 
    requestedDeadline: Date, 
    reason: string, 
    workerId: string
): Promise<void> => {
    if (!reason.trim()) {
        throw new Error('A reason for the deadline extension is required.');
    }

    if (requestedDeadline <= new Date()) {
        throw new Error('The requested deadline must be in the future.');
    }

    // 1. Check if the worker is assigned to this project
    const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('worker_id, deadline, title')
        .eq('id', projectId)
        .single();

    if (projectError || !projectData) {
        throw new Error('Could not find project.');
    }

    if (projectData.worker_id !== workerId) {
        throw new Error('You are not assigned to this project.');
    }

    const currentDeadline = new Date(projectData.deadline);
    if (requestedDeadline <= currentDeadline) {
        throw new Error('The requested deadline must be later than the current deadline.');
    }

    // 2. Insert deadline extension request
    const { error: insertError } = await supabase
        .from('deadline_extension_requests')
        .insert([{
            project_id: projectId,
            worker_id: workerId,
            requested_deadline: requestedDeadline.toISOString(),
            reason: reason,
            status: 'pending'
        }]);

    if (insertError) {
        console.error(`Error creating deadline extension request for project ${projectId}:`, insertError);
        throw new Error('Failed to submit deadline extension request. Please try again.');
    }

    // 3. Add a note about the extension request
    const { error: noteError } = await supabase
        .from('project_notes')
        .insert([{
            project_id: projectId,
            author_id: workerId,
            note: `Deadline extension requested. New deadline: ${requestedDeadline.toLocaleDateString()}. Reason: ${reason}`
        }]);

    if (noteError) {
        console.error(`Error adding extension request note for project ${projectId}:`, noteError);
        // Don't throw here as the main request succeeded
    }

    // 4. Notify agents about the extension request
    fireAndForgetNotification(sendNotification({
        target: { role: 'agent' },
        payload: {
            title: 'Deadline Extension Request',
            body: `Worker has requested a deadline extension for project #${projectId} "${projectData.title}".`
        }
    }));

    // 5. Notify the client about the extension request
    const { clientId } = await getProjectParticipantIds(projectId);
    if (clientId) {
        fireAndForgetNotification(sendNotification({
            target: { userIds: [clientId] },
            payload: {
                title: 'Deadline Extension Requested',
                body: `The worker has requested a deadline extension for your project #${projectId}. You will be notified of the decision.`
            }
        }));
    }
};

/**
 * Fetches deadline extension requests for a project.
 * @param projectId The ID of the project.
 * @returns A promise that resolves to an array of deadline extension requests.
 */
export const getDeadlineExtensionRequests = async (projectId: number): Promise<Database['public']['Tables']['deadline_extension_requests']['Row'][]> => {
    const { data, error } = await supabase
        .from('deadline_extension_requests')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(`Error fetching deadline extension requests for project ${projectId}:`, error);
        throw new Error('Could not load deadline extension requests.');
    }

    return data || [];
};