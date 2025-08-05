import { supabase } from '../services/supabase';
import { Project, Profile } from '../types';
import { projectCache, userCache, analyticsCache } from './cacheManager';
import { performanceMonitor } from './performanceMonitor';

interface QueryOptions {
  useCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  timeout?: number;
}

interface PaginationOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

interface FilterOptions {
  startDate?: Date;
  endDate?: Date;
  status?: string[];
  clientId?: string;
  workerId?: string;
  searchTerm?: string;
}

class QueryOptimizer {
  // Optimized project queries with caching and pagination
  async getProjectsForWorker(
    workerId: string,
    options: QueryOptions & PaginationOptions & FilterOptions = {}
  ): Promise<{ data: Project[]; total: number; hasMore: boolean }> {
    const {
      useCache = true,
      cacheKey = `worker-projects-${workerId}`,
      cacheTTL = 2 * 60 * 1000, // 2 minutes
      page = 1,
      pageSize = 20,
      orderBy = 'updated_at',
      orderDirection = 'desc',
      ...filters
    } = options;

    // Try cache first if enabled
    if (useCache && !this.hasFilters(filters)) {
      const cached = projectCache.get<{ data: Project[]; total: number; hasMore: boolean }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    return performanceMonitor.measure(
      'optimized-worker-projects-query',
      async () => {
        let query = supabase
          .from('projects')
          .select(`
            *,
            client:users!projects_client_id_fkey(id, full_name),
            worker:users!projects_worker_id_fkey(id, full_name)
          `, { count: 'exact' })
          .eq('worker_id', workerId);

        // Apply filters
        query = this.applyFilters(query, filters);

        // Apply pagination and ordering
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        query = query
          .order(orderBy, { ascending: orderDirection === 'asc' })
          .range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        const result = {
          data: data || [],
          total: count || 0,
          hasMore: (count || 0) > page * pageSize
        };

        // Cache result if no filters applied
        if (useCache && !this.hasFilters(filters)) {
          projectCache.set(cacheKey, result, cacheTTL);
        }

        return result;
      },
      { workerId, page, pageSize }
    );
  }

  // Optimized agent projects query with advanced filtering
  async getProjectsForAgent(
    options: QueryOptions & PaginationOptions & FilterOptions = {}
  ): Promise<{ data: Project[]; total: number; hasMore: boolean }> {
    const {
      useCache = true,
      cacheKey = 'agent-projects',
      cacheTTL = 2 * 60 * 1000,
      page = 1,
      pageSize = 50,
      orderBy = 'updated_at',
      orderDirection = 'desc',
      ...filters
    } = options;

    // Try cache first if no filters
    if (useCache && !this.hasFilters(filters)) {
      const cached = projectCache.get<{ data: Project[]; total: number; hasMore: boolean }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    return performanceMonitor.measure(
      'optimized-agent-projects-query',
      async () => {
        let query = supabase
          .from('projects')
          .select(`
            *,
            client:users!projects_client_id_fkey(id, full_name),
            worker:users!projects_worker_id_fkey(id, full_name)
          `, { count: 'exact' });

        // Apply filters
        query = this.applyFilters(query, filters);

        // Apply pagination and ordering
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        query = query
          .order(orderBy, { ascending: orderDirection === 'asc' })
          .range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        const result = {
          data: data || [],
          total: count || 0,
          hasMore: (count || 0) > page * pageSize
        };

        // Cache if no filters
        if (useCache && !this.hasFilters(filters)) {
          projectCache.set(cacheKey, result, cacheTTL);
        }

        return result;
      },
      { page, pageSize, filtersApplied: this.hasFilters(filters) }
    );
  }

  // Optimized analytics query with caching
  async getAnalyticsData(
    startDate: Date,
    endDate: Date,
    options: QueryOptions = {}
  ): Promise<{
    totalProjects: number;
    totalRevenue: number;
    totalProfit: number;
    clientCount: number;
    monthlyData: Array<{
      month: string;
      projects: number;
      revenue: number;
      profit: number;
    }>;
  }> {
    const {
      useCache = true,
      cacheKey = `analytics-${startDate.toISOString()}-${endDate.toISOString()}`,
      cacheTTL = 5 * 60 * 1000 // 5 minutes
    } = options;

    if (useCache) {
      const cached = analyticsCache.get<{
        totalProjects: number;
        totalRevenue: number;
        totalProfit: number;
        clientCount: number;
        monthlyData: Array<{
          month: string;
          projects: number;
          revenue: number;
          profit: number;
        }>;
      }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    return performanceMonitor.measure(
      'optimized-analytics-query',
      async () => {
        // Single query to get all needed data
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            total_price,
            worker_payment,
            client_id,
            created_at,
            status
          `)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .in('status', ['completed', 'in_progress', 'pending_final_approval']);

        if (error) throw error;

        // Process data in memory for better performance
        const projects = data || [];
        const uniqueClients = new Set(projects.map(p => p.client_id));

        const totalRevenue = projects.reduce((sum, p) => sum + (p.total_price || 0), 0);
        const totalProfit = projects.reduce((sum, p) => sum + ((p.total_price || 0) - (p.worker_payment || 0)), 0);

        // Group by month for monthly data
        const monthlyGroups = projects.reduce((groups, project) => {
          const month = new Date(project.created_at).toISOString().slice(0, 7); // YYYY-MM
          if (!groups[month]) {
            groups[month] = [];
          }
          groups[month].push(project);
          return groups;
        }, {} as Record<string, typeof projects>);

        const monthlyData = Object.entries(monthlyGroups).map(([month, monthProjects]) => ({
          month,
          projects: monthProjects.length,
          revenue: monthProjects.reduce((sum, p) => sum + (p.total_price || 0), 0),
          profit: monthProjects.reduce((sum, p) => sum + ((p.total_price || 0) - (p.worker_payment || 0)), 0)
        }));

        const result = {
          totalProjects: projects.length,
          totalRevenue,
          totalProfit,
          clientCount: uniqueClients.size,
          monthlyData
        };

        if (useCache) {
          analyticsCache.set(cacheKey, result, cacheTTL);
        }

        return result;
      },
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() }
    );
  }

  // Optimized user lookup with caching
  async getUsers(
    userIds: string[],
    options: QueryOptions = {}
  ): Promise<Profile[]> {
    const {
      useCache = true,
      cacheTTL = 10 * 60 * 1000 // 10 minutes
    } = options;

    // Check cache for each user
    const cachedUsers: Profile[] = [];
    const uncachedIds: string[] = [];

    if (useCache) {
      userIds.forEach(id => {
        const cached = userCache.get<Profile>(`user-${id}`);
        if (cached) {
          cachedUsers.push(cached);
        } else {
          uncachedIds.push(id);
        }
      });
    } else {
      uncachedIds.push(...userIds);
    }

    // Fetch uncached users
    let fetchedUsers: Profile[] = [];
    if (uncachedIds.length > 0) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('id', uncachedIds);

      if (error) throw error;

      fetchedUsers = data || [];

      // Cache fetched users
      if (useCache) {
        fetchedUsers.forEach(user => {
          userCache.set(`user-${user.id}`, user, cacheTTL);
        });
      }
    }

    return [...cachedUsers, ...fetchedUsers];
  }

  // Apply filters to query
  private applyFilters(query: any, filters: FilterOptions): any {
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    if (filters.workerId) {
      query = query.eq('worker_id', filters.workerId);
    }

    if (filters.searchTerm) {
      query = query.or(`title.ilike.%${filters.searchTerm}%,order_reference.ilike.%${filters.searchTerm}%`);
    }

    return query;
  }

  // Check if any filters are applied
  private hasFilters(filters: FilterOptions): boolean {
    return !!(
      filters.startDate ||
      filters.endDate ||
      (filters.status && filters.status.length > 0) ||
      filters.clientId ||
      filters.workerId ||
      filters.searchTerm
    );
  }

  // Invalidate cache for specific patterns
  invalidateCache(pattern: string): void {
    if (pattern.includes('projects')) {
      projectCache.clear();
    }
    if (pattern.includes('users')) {
      userCache.clear();
    }
    if (pattern.includes('analytics')) {
      analyticsCache.clear();
    }
  }

  // Preload commonly accessed data
  async preloadData(): Promise<void> {
    try {
      // Preload recent projects
      await this.getProjectsForAgent({
        useCache: true,
        page: 1,
        pageSize: 20
      });

      // Preload analytics for current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      await this.getAnalyticsData(startOfMonth, now, { useCache: true });

    } catch (error) {
      console.warn('Failed to preload data:', error);
    }
  }
}

// Global instance
export const queryOptimizer = new QueryOptimizer();

// Export types
export type { QueryOptions, PaginationOptions, FilterOptions };