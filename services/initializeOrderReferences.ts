/**
 * Initialize Order References Utility
 * This utility ensures all existing projects have order reference numbers
 * and should be run during application startup or as a migration script
 */

import { OrderReferenceGenerator } from './orderReferenceGenerator';

/**
 * Initializes order references for all projects
 * This function should be called during application startup
 */
export async function initializeOrderReferences(): Promise<void> {
  try {
    console.log('Initializing order references for existing projects...');
    await OrderReferenceGenerator.ensureAllProjectsHaveReferences();
    console.log('Order reference initialization complete.');
  } catch (error) {
    console.error('Error during order reference initialization:', error);
  }
}

/**
 * Validates that all projects have order references
 * This can be used for health checks
 */
export async function validateOrderReferences(): Promise<boolean> {
  try {
    const { supabase } = await import('./supabase');
    
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .is('order_reference', null)
      .limit(1);

    if (error) {
      console.error('Error validating order references:', error);
      return false;
    }

    return !data || data.length === 0;
  } catch (error) {
    console.error('Error in validateOrderReferences:', error);
    return false;
  }
}