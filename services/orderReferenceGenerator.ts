/**
 * Order Reference Generator Utility
 * Generates unique order reference numbers in the format "ORD-YYYY-MM-XXXXXX"
 * where XXXXXX is a 6-digit sequential number
 */

import { supabase } from './supabase';

export class OrderReferenceGenerator {
  private static readonly PREFIX = 'ORD';
  private static readonly SEQUENCE_LENGTH = 6;

  /**
   * Generates a new unique order reference number
   * Format: ORD-YYYY-MM-XXXXXX
   * @returns Promise<string> The generated order reference
   */
  static async generate(): Promise<string> {
    const maxRetries = 10;
    let attempts = 0;

    while (attempts < maxRetries) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      
      // Get the next sequence number for this month
      const sequence = await this.getNextSequenceNumber(year, month);
      const sequenceStr = String(sequence).padStart(this.SEQUENCE_LENGTH, '0');
      
      const reference = `${this.PREFIX}-${year}-${month}-${sequenceStr}`;
      
      // Check if this reference is unique
      const isUnique = await this.isUnique(reference);
      if (isUnique) {
        return reference;
      }

      attempts++;
      console.warn(`Order reference collision detected: ${reference}. Retrying... (${attempts}/${maxRetries})`);
      
      // Add a small delay before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // If we've exhausted retries, fall back to timestamp-based generation
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now() % 1000000;
    const fallbackReference = `${this.PREFIX}-${year}-${month}-${String(timestamp).padStart(this.SEQUENCE_LENGTH, '0')}`;
    
    console.warn(`Using fallback order reference: ${fallbackReference}`);
    return fallbackReference;
  }

  /**
   * Validates an order reference format
   * @param reference The order reference to validate
   * @returns boolean True if valid format
   */
  static validate(reference: string): boolean {
    const pattern = /^ORD-\d{4}-\d{2}-\d{6}$/;
    return pattern.test(reference);
  }

  /**
   * Checks if an order reference is unique in the database
   * @param reference The order reference to check
   * @returns Promise<boolean> True if unique, false if already exists
   */
  static async isUnique(reference: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id')
        .eq('order_reference', reference)
        .limit(1);

      if (error) {
        console.error('Error checking order reference uniqueness:', error);
        return false;
      }

      return !data || data.length === 0;
    } catch (error) {
      console.error('Error in isUnique check:', error);
      return false;
    }
  }

  /**
   * Validates an order reference format and uniqueness
   * @param reference The order reference to validate
   * @returns Promise<{valid: boolean, unique: boolean, error?: string}> Validation result
   */
  static async validateAndCheckUniqueness(reference: string): Promise<{
    valid: boolean;
    unique: boolean;
    error?: string;
  }> {
    try {
      const valid = this.validate(reference);
      if (!valid) {
        return {
          valid: false,
          unique: false,
          error: 'Invalid order reference format. Expected format: ORD-YYYY-MM-XXXXXX'
        };
      }

      const unique = await this.isUnique(reference);
      return {
        valid: true,
        unique,
        error: unique ? undefined : 'Order reference already exists'
      };
    } catch (error) {
      return {
        valid: false,
        unique: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Extracts components from an order reference
   * @param reference The order reference to parse
   * @returns Object with year, month, and sequence components
   */
  static parse(reference: string): { year: number; month: number; sequence: number } | null {
    if (!this.validate(reference)) {
      return null;
    }

    const parts = reference.split('-');
    return {
      year: parseInt(parts[1], 10),
      month: parseInt(parts[2], 10),
      sequence: parseInt(parts[3], 10)
    };
  }

  /**
   * Gets the next sequence number for the given year and month
   * @param year The year
   * @param month The month (01-12)
   * @returns Promise<number> The next sequence number
   */
  private static async getNextSequenceNumber(year: number, month: string): Promise<number> {
    try {
      // Query for the highest sequence number in this month
      const prefix = `${this.PREFIX}-${year}-${month}-`;
      
      const { data, error } = await supabase
        .from('projects')
        .select('order_reference')
        .like('order_reference', `${prefix}%`)
        .order('order_reference', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching sequence number:', error);
        // If there's an error, start from 1
        return 1;
      }

      if (!data || data.length === 0) {
        // No existing references for this month, start from 1
        return 1;
      }

      const lastReference = data[0].order_reference;
      if (!lastReference) {
        return 1;
      }

      const parsed = this.parse(lastReference);
      if (!parsed) {
        return 1;
      }

      return parsed.sequence + 1;
    } catch (error) {
      console.error('Error in getNextSequenceNumber:', error);
      // Fallback to timestamp-based sequence to ensure uniqueness
      return Date.now() % 1000000;
    }
  }

  /**
   * Generates order references for existing projects that don't have them
   * This is a utility function for migration purposes
   * @returns Promise<number> Number of projects updated
   */
  static async generateForExistingProjects(): Promise<number> {
    try {
      // Get all projects without order references
      const { data: projects, error: fetchError } = await supabase
        .from('projects')
        .select('id, created_at')
        .is('order_reference', null)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching projects without order references:', fetchError);
        return 0;
      }

      if (!projects || projects.length === 0) {
        return 0;
      }

      let updatedCount = 0;

      // Generate order references for each project
      for (const project of projects) {
        try {
          const orderReference = await this.generate();
          
          const { error: updateError } = await supabase
            .from('projects')
            .update({ order_reference: orderReference })
            .eq('id', project.id);

          if (updateError) {
            console.error(`Error updating project ${project.id}:`, updateError);
          } else {
            updatedCount++;
          }
        } catch (error) {
          console.error(`Error generating reference for project ${project.id}:`, error);
        }
      }

      console.log(`Generated order references for ${updatedCount} projects`);
      return updatedCount;
    } catch (error) {
      console.error('Error in generateForExistingProjects:', error);
      return 0;
    }
  }

  /**
   * Ensures all projects have order references
   * This should be called during application initialization
   */
  static async ensureAllProjectsHaveReferences(): Promise<void> {
    try {
      const updatedCount = await this.generateForExistingProjects();
      if (updatedCount > 0) {
        console.log(`Order reference generation complete. Updated ${updatedCount} projects.`);
      }
    } catch (error) {
      console.error('Error ensuring all projects have references:', error);
    }
  }
}

// Export utility functions for easier use
export const generateOrderReference = () => OrderReferenceGenerator.generate();
export const validateOrderReference = (reference: string) => OrderReferenceGenerator.validate(reference);
export const parseOrderReference = (reference: string) => OrderReferenceGenerator.parse(reference);
export const checkOrderReferenceUniqueness = (reference: string) => OrderReferenceGenerator.isUnique(reference);
export const validateAndCheckOrderReference = (reference: string) => OrderReferenceGenerator.validateAndCheckUniqueness(reference);