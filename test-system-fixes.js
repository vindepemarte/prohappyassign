/**
 * Test script to verify system fixes
 * Run this in browser console to test the fixes
 */

// Test 1: Check if word count change sets correct status
async function testWordCountChange() {
  console.log('🧪 Testing word count change...');
  
  try {
    // This would be called from the modal
    const projectId = 1; // Replace with actual project ID
    const newWordCount = 1500;
    
    // Simulate the function call
    console.log(`Requesting word count change for project ${projectId} to ${newWordCount} words`);
    
    // Check if status is set to 'pending_quote_approval'
    const { data: project } = await supabase
      .from('projects')
      .select('status, adjusted_word_count')
      .eq('id', projectId)
      .single();
    
    console.log('Project status after change:', project);
    
    if (project.status === 'pending_quote_approval') {
      console.log('✅ Word count change status is correct');
    } else {
      console.log('❌ Word count change status is incorrect:', project.status);
    }
  } catch (error) {
    console.error('❌ Error testing word count change:', error);
  }
}

// Test 2: Check notification system
async function testNotificationSystem() {
  console.log('🧪 Testing notification system...');
  
  try {
    // Check if notifications are being logged
    const { data: notifications } = await supabase
      .from('notification_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('Recent notifications:', notifications);
    
    if (notifications && notifications.length > 0) {
      console.log('✅ Notification system is logging notifications');
    } else {
      console.log('❌ No notifications found in history');
    }
  } catch (error) {
    console.error('❌ Error testing notification system:', error);
  }
}

// Test 3: Check user search
async function testUserSearch() {
  console.log('🧪 Testing user search...');
  
  try {
    const searchTerm = 'test'; // Replace with actual search term
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .or(`full_name.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`)
      .limit(10);
    
    if (error) {
      console.error('❌ User search error:', error);
      return;
    }
    
    console.log('User search results:', users);
    
    if (users && users.length > 0) {
      console.log('✅ User search is working');
    } else {
      console.log('⚠️ No users found for search term:', searchTerm);
    }
  } catch (error) {
    console.error('❌ Error testing user search:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running system fix tests...');
  
  await testWordCountChange();
  await testNotificationSystem();
  await testUserSearch();
  
  console.log('✅ All tests completed');
}

// Export for use
window.testSystemFixes = {
  testWordCountChange,
  testNotificationSystem,
  testUserSearch,
  runAllTests
};

console.log('Test functions loaded. Run window.testSystemFixes.runAllTests() to test all fixes.');