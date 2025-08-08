// This file has been migrated to PostgreSQL
// Legacy compatibility layer for existing code

console.warn('⚠️  Supabase has been replaced with PostgreSQL. Update your imports to use the new auth system.');

// Placeholder for old Supabase calls - these will throw errors to help identify what needs migration
export const supabase = {
  from: (table: string) => {
    throw new Error(`supabase.from('${table}') is no longer supported. Use direct PostgreSQL queries via API endpoints.`);
  },
  auth: {
    getUser: () => {
      throw new Error('supabase.auth.getUser() is no longer supported. Use /api/auth/me endpoint.');
    },
    getSession: () => {
      throw new Error('supabase.auth.getSession() is no longer supported. Use localStorage token.');
    },
    signUp: () => {
      throw new Error('supabase.auth.signUp() is no longer supported. Use /api/auth/register endpoint.');
    },
    signInWithPassword: () => {
      throw new Error('supabase.auth.signInWithPassword() is no longer supported. Use /api/auth/login endpoint.');
    },
    signOut: () => {
      throw new Error('supabase.auth.signOut() is no longer supported. Use /api/auth/logout endpoint.');
    },
  }
};

// Re-export database functions for server-side use only
export { query, transaction, getClient, pool } from './database.js';
export { register, login, getUserById, verifySession } from './auth.js';