import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';

// IMPORTANT: The environment variables for Supabase were not provided.
// The application is using placeholder values and will not connect to a real database.
// To connect to your Supabase project, replace the placeholder strings below
// with your actual Supabase URL and Anon Key. It's recommended to load these
// from a secure environment configuration rather than hard-coding them.

const supabaseUrl = 'https://phyiecaydfyykcwwltjj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoeWllY2F5ZGZ5eWtjd3dsdGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNTk0MjMsImV4cCI6MjA2OTgzNTQyM30.mM3QiDHgTEYm6VLFWc_FP3Ie6Eo-8iZ2Mh00XBnErKs';

// This check helps developers know they are using placeholder values.
if (supabaseUrl.includes('your-project-id')) {
  const message = "WARNING: Supabase is not configured. The app is running with placeholder credentials and will not connect to a database. Please update services/supabase.ts with your actual Supabase project URL and anonymous key to enable database functionality.";
  
  // Display a prominent warning in the console for developers.
  console.warn(
    `%c${message}`,
    'color: #D97706; font-size: 14px; font-weight: bold; background-color: #FFFBEB; padding: 10px; border-left: 5px solid #FBBF24; border-radius: 4px;'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
