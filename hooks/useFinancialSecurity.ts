import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface FinancialPermissions {
  canViewAllFinancials: boolean;
  canViewProfitData: boolean;
  canViewPaymentDistribution: boolean;
  canViewAgentFees: boolean;
  canViewWorkerPayments: boolean;
  canViewClientPricing: boolean;
  canModifyPricing: boolean;
  canViewSystemProfits: boolean;
}

interface FinancialSummary {
  total_projects: number;
  total_revenue?: number;
  accessible_fees?: number;
  accessible_payments?: number;
  accessible_profit?: number;
  access_level: string;
}

export const useFinancialSecurity = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<FinancialPermissions | null>(null);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchFinancialPermissions();
      fetchFinancialSummary();
    }
  }, [user]);

  const fetchFinancialPermissions = async () => {
    try {
      const response = await fetch('/api/financial-security/permissions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.data.permissions);
      } else {
        throw new Error('Failed to fetch financial permissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching financial permissions:', err);
    }
  };

  const fetchFinancialSummary = async () => {
    try {
      const response = await fetch('/api/financial-security/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.data);
      } else {
        throw new Error('Failed to fetch financial summary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching financial summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateAccess = async (permission: string, resourceId?: string, resourceType?: string) => {
    try {
      const response = await fetch('/api/financial-security/validate-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          permission,
          resourceId,
          resourceType
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.data.hasAccess;
      } else {
        return false;
      }
    } catch (err) {
      console.error('Error validating financial access:', err);
      return false;
    }
  };

  const getFilteredProjects = async (limit = 50, offset = 0) => {
    try {
      const response = await fetch(`/api/financial-security/projects?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      } else {
        throw new Error('Failed to fetch filtered projects');
      }
    } catch (err) {
      console.error('Error fetching filtered projects:', err);
      throw err;
    }
  };

  const getFilteredUsers = async (limit = 50) => {
    try {
      const response = await fetch(`/api/financial-security/users?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      } else {
        throw new Error('Failed to fetch filtered users');
      }
    } catch (err) {
      console.error('Error fetching filtered users:', err);
      throw err;
    }
  };

  const getProjectFinancialData = async (projectId: string) => {
    try {
      const response = await fetch(`/api/financial-security/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      } else {
        throw new Error('Failed to fetch project financial data');
      }
    } catch (err) {
      console.error('Error fetching project financial data:', err);
      throw err;
    }
  };

  const getAuditLogs = async (limit = 100) => {
    try {
      const response = await fetch(`/api/financial-security/audit?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      } else {
        throw new Error('Failed to fetch audit logs');
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      throw err;
    }
  };

  // Helper functions for common permission checks
  const canViewFinancialData = () => {
    return permissions?.canViewAllFinancials || 
           permissions?.canViewAgentFees || 
           permissions?.canViewClientPricing || false;
  };

  const canViewProfitData = () => {
    return permissions?.canViewProfitData || false;
  };

  const canViewPaymentData = () => {
    return permissions?.canViewPaymentDistribution || 
           permissions?.canViewWorkerPayments || false;
  };

  const canModifyPricing = () => {
    return permissions?.canModifyPricing || false;
  };

  const shouldHideFinancialInfo = () => {
    return user?.role === 'worker';
  };

  const getAccessLevel = () => {
    if (!permissions) return 'none';
    
    if (permissions.canViewAllFinancials) return 'full';
    if (permissions.canViewAgentFees || permissions.canViewClientPricing) return 'limited';
    return 'none';
  };

  return {
    permissions,
    summary,
    loading,
    error,
    validateAccess,
    getFilteredProjects,
    getFilteredUsers,
    getProjectFinancialData,
    getAuditLogs,
    canViewFinancialData,
    canViewProfitData,
    canViewPaymentData,
    canModifyPricing,
    shouldHideFinancialInfo,
    getAccessLevel,
    refresh: () => {
      fetchFinancialPermissions();
      fetchFinancialSummary();
    }
  };
};

export default useFinancialSecurity;