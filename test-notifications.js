// Simple test script for notifications
// Run with: node test-notifications.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://phyiecaydfyykcwwltjj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoeWllY2F5ZGZ5eWtjd3dsdGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNTk0MjMsImV4cCI6MjA2OTgzNTQyM30.mM3QiDHgTEYm6VLFWc_FP3Ie6Eo-8iZ2Mh00XBnErKs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNotifications() {
  console.log('🧪 Testing notification system...');
  
  try {
    // Test 1: Check if notification_history table exists
    console.log('1. Checking notification_history table...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('notification_history')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('❌ notification_history table issue:', tableError.message);
      console.log('💡 Run fix-notification-table.sql in Supabase SQL editor');
    } else {
      console.log('✅ notification_history table exists');
    }
    
    // Test 2: Test edge function
    console.log('2. Testing edge function...');
    const { data: funcData, error: funcError } = await supabase.functions.invoke('send-push-notification', {
      body: {
        target: { role: 'agent' },
        payload: {
          title: 'Test Notification',
          body: 'This is a test notification'
        }
      }
    });
    
    if (funcError) {
      console.error('❌ Edge function error:', funcError.message);
      console.log('💡 Deploy edge function with: supabase functions deploy send-push-notification');
    } else {
      console.log('✅ Edge function working:', funcData);
    }
    
    // Test 3: Check users table
    console.log('3. Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role')
      .limit(5);
    
    if (usersError) {
      console.error('❌ Users table issue:', usersError.message);
    } else {
      console.log('✅ Users table accessible:', users?.length || 0, 'users found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNotifications();