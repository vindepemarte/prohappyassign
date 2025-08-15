/**
 * API Service - Replaces Supabase with direct API calls to our PostgreSQL backend
 */

const API_BASE = '/api';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
};

// Projects API
export const projectsApi = {
  // Get all projects for current user
  getAll: async () => {
    const response = await fetch(`${API_BASE}/projects`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get project by ID
  getById: async (id: number) => {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Create new project
  create: async (projectData: any) => {
    const response = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(projectData)
    });
    return handleResponse(response);
  },

  // Update project status
  updateStatus: async (id: number, status: string) => {
    const response = await fetch(`${API_BASE}/projects/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    return handleResponse(response);
  },

  // Assign worker to project
  assignWorker: async (id: number, workerId: string) => {
    const response = await fetch(`${API_BASE}/projects/${id}/assign-worker`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ workerId })
    });
    return handleResponse(response);
  },

  // Get available workers
  getWorkers: async () => {
    const response = await fetch(`${API_BASE}/projects/workers/available`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Submit change request
  submitChangeRequest: async (id: number, instructions: string) => {
    const response = await fetch(`${API_BASE}/projects/${id}/change-request`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ instructions })
    });
    return handleResponse(response);
  }
};

// Users API
export const usersApi = {
  // Get users by IDs
  getByIds: async (userIds: string[]) => {
    const response = await fetch(`${API_BASE}/users/by-ids`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userIds })
    });
    return handleResponse(response);
  },

  // Get users by role
  getByRole: async (role: string) => {
    const response = await fetch(`${API_BASE}/users/by-role/${role}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get all users (super_agent only)
  getAll: async () => {
    const response = await fetch(`${API_BASE}/users/all`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

// Notifications API
export const notificationsApi = {
  // Create notification
  create: async (notificationData: any) => {
    const response = await fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(notificationData)
    });
    return handleResponse(response);
  },

  // Update notification status
  updateStatus: async (id: number, statusData: any) => {
    const response = await fetch(`${API_BASE}/notifications/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(statusData)
    });
    return handleResponse(response);
  },

  // Get failed notifications
  getFailed: async () => {
    const response = await fetch(`${API_BASE}/notifications/failed`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get notification history
  getHistory: async (userId: string, limit: number = 50) => {
    const response = await fetch(`${API_BASE}/notifications/history/${userId}?limit=${limit}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get analytics
  getAnalytics: async (startDate?: string, endDate?: string) => {
    let url = `${API_BASE}/notifications/analytics`;
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Increment retry count
  incrementRetry: async (id: number) => {
    const response = await fetch(`${API_BASE}/notifications/${id}/retry`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Cleanup old notifications
  cleanup: async () => {
    const response = await fetch(`${API_BASE}/notifications/cleanup`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

// Files API
export const filesApi = {
  // Upload files
  upload: async (projectId: number, files: FileList, purpose: string = 'general') => {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    formData.append('purpose', purpose);

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE}/files/upload/${projectId}`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });
    return handleResponse(response);
  },

  // Get files for project
  getByProject: async (projectId: number) => {
    const response = await fetch(`${API_BASE}/files/project/${projectId}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get file URL
  getUrl: async (fileId: number) => {
    const response = await fetch(`${API_BASE}/files/url/${fileId}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Download file
  download: async (fileId: number) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE}/files/download/${fileId}`, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
    
    if (!response.ok) {
      throw new Error('Download failed');
    }
    
    return response.blob();
  },

  // Delete file
  delete: async (fileId: number) => {
    const response = await fetch(`${API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

// Generic database operations (for backward compatibility)
export const dbApi = {
  // Generic select operation
  select: async (table: string, columns: string = '*', conditions: any = {}) => {
    // This is a simplified version - in practice, you'd create specific endpoints
    // For now, we'll map common operations to existing endpoints
    
    if (table === 'projects') {
      return projectsApi.getAll();
    }
    
    throw new Error(`Generic select for table '${table}' not implemented. Use specific API methods.`);
  },

  // Generic insert operation
  insert: async (table: string, data: any) => {
    if (table === 'projects') {
      return projectsApi.create(data);
    }
    
    if (table === 'notification_history') {
      return notificationsApi.create(data);
    }
    
    throw new Error(`Generic insert for table '${table}' not implemented. Use specific API methods.`);
  },

  // Generic update operation
  update: async (table: string, data: any, conditions: any) => {
    throw new Error(`Generic update for table '${table}' not implemented. Use specific API methods.`);
  }
};