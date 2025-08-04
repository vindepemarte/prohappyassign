

import { supabase } from './supabase';
import type { NewProjectFormData, Project, ChangesFormData, Database, ProjectStatus, Profile, ProjectWithDetails } from '../types';
import { PRICING_TABLE } from '../constants';
import { sendNotification } from './notificationService';

const PROJECT_COLUMNS = 'id, client_id, worker_id, agent_id, title, description, status, initial_word_count, adjusted_word_count, cost_gbp, deadline, created_at, updated_at';

/**
 * Calculates the price based on word count from the pricing table.
 * @param wordCount The number of words.
 * @returns The calculated price in GBP.
 */
export const calculatePrice = (wordCount: number): number => {
    if (wordCount <= 0) return 0;

    const tier = PRICING_TABLE.find(p => wordCount <= p.maxWords);
    return tier ? tier.price : PRICING_TABLE[PRICING_TABLE.length - 1].price; // Default to max price if over
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
    // 1. Calculate price
    const cost = calculatePrice(data.wordCount);

    // 2. Insert project record to get an ID
    const projectToInsert = {
        client_id: userId,
        title: data.title,
        initial_word_count: data.wordCount,
        deadline: data.deadline,
        description: data.guidance,
        cost_gbp: cost,
        status: 'pending_payment_approval' as const,
    };

    const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([projectToInsert])
        .select()
        .single();

    if (projectError || !projectData) {
        console.error('Error inserting project:', projectError);
        throw new Error('Failed to save your project. Please try again.');
    }
    
    const projectId = projectData.id;

    // 3. Upload files
    const uploadedFiles = await uploadFiles(data.files, userId, projectId);

    // 4. Insert file records into project_files
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

    // 5. Notify agents of new project
    fireAndForgetNotification(sendNotification({
        target: { role: 'agent' },
        payload: {
            title: 'New Assignment Submitted',
            body: `Project "${data.title}" has been submitted for approval.`
        }
    }));
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

    // 4. Notify worker
    const { workerId } = await getProjectParticipantIds(data.projectId);
    if (workerId) {
        fireAndForgetNotification(sendNotification({
            target: { userIds: [workerId] },
            payload: {
                title: 'Changes Requested',
                body: `The client has requested changes for project #${data.projectId}.`
            }
        }));
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
    const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_COLUMNS)
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching worker projects:', error);
        throw new Error('Could not load assigned projects.');
    }
    return data || [];
};

/**
 * Fetches all projects in the system (for agents).
 * @returns A promise that resolves to an array of all projects.
 */
export const getAllProjectsForAgent = async (): Promise<Project[]> => {
    const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_COLUMNS)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all projects for agent:', error);
        throw new Error('Could not load system projects.');
    }
    return data || [];
};

/**
 * Updates the status of a specific project (for agents).
 * @param projectId The ID of the project to update.
 * @param status The new status for the project.
 */
export const updateProjectStatus = async (projectId: number, status: ProjectStatus): Promise<void> => {
    const { error } = await supabase
        .from('projects')
        .update({ status: status })
        .eq('id', projectId);

    if (error) {
        console.error(`Error updating project ${projectId} status:`, error);
        throw new Error('Failed to update project status.');
    }
    
    // Send notification on completion
    if (status === 'completed') {
        const { clientId } = await getProjectParticipantIds(projectId);
        if (clientId) {
            fireAndForgetNotification(sendNotification({
                target: { userIds: [clientId] },
                payload: {
                    title: 'Project Completed!',
                    body: `Your project #${projectId} has been marked as completed.`
                }
            }));
        }
    }
};


/**
 * Fetches all users with the 'worker' role.
 * @returns A promise that resolves to an array of worker profiles.
 */
export const getAllWorkers = async (): Promise<Profile[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'worker');

    if (error) {
        console.error('Error fetching workers:', error);
        throw new Error('Could not load workers.');
    }
    return data || [];
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
    
    // Notify the assigned worker
    fireAndForgetNotification(sendNotification({
        target: { userIds: [workerId] },
        payload: {
            title: 'You have a new assignment!',
            body: `You have been assigned to project #${projectId}.`
        }
    }));
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

    return {
        ...projectData,
        project_files: filesData || [],
        project_change_requests: changesData || [],
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
    // 1. Calculate new price
    const newCost = calculatePrice(newWordCount);

    // 2. Update project with new word count, price, and status
    const { error } = await supabase
        .from('projects')
        .update({
            adjusted_word_count: newWordCount,
            cost_gbp: newCost,
            status: 'pending_quote_approval',
        })
        .eq('id', projectId);
    
    if (error) {
        throw new Error(`Failed to request word count change: ${error.message}`);
    }

    // 3. Notify agents
    fireAndForgetNotification(sendNotification({
        target: { role: 'agent' },
        payload: {
            title: 'Quote Change Request',
            body: `A worker has requested a new quote for project #${projectId}.`
        }
    }));
};

/**
 * Approves a new quote proposed by a worker.
 * @param projectId The ID of the project.
 */
export const approveQuoteChange = async (projectId: number): Promise<void> => {
    const { error } = await supabase
        .from('projects')
        .update({ status: 'in_progress' })
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
    const originalCost = calculatePrice(originalWordCount);

    const { error } = await supabase
        .from('projects')
        .update({
            status: 'in_progress',
            adjusted_word_count: null,
            cost_gbp: originalCost,
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