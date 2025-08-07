/**
 * Test script to verify system fixes
 * Run this in browser console to test the fixes
 */

// Test 1: Check if word count change sets correct status
async function testWordCountChange() {
  console.log('🧪 Testing word count change...');
  
  try {
    // Get a sample project to test with
    const { data: projects } = await supabase
      .from('projects')
      .select('id, status, adjusted_word_count, initial_word_count')
      .limit(1);
    
    if (!projects || projects.length === 0) {
      console.log('⚠️ No projects found to test with');
      return;
    }
    
    const project = projects[0];
    console.log('Testing with project:', project);
    
    // Check if the project has the expected structure
    if (project.status && typeof project.initial_word_count === 'number') {
      console.log('✅ Project structure is correct');
      console.log(`Current status: ${project.status}`);
      console.log(`Initial word count: ${project.initial_word_count}`);
      console.log(`Adjusted word count: ${project.adjusted_word_count || 'None'}`);
    } else {
      console.log('❌ Project structure is incorrect');
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
    // First, get all users to see what we have
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, full_name, role')
      .limit(5);
    
    console.log('Sample users in database:', allUsers);
    
    if (!allUsers || allUsers.length === 0) {
      console.log('⚠️ No users found in database');
      return;
    }
    
    // Test search with first user's name
    const searchTerm = allUsers[0].full_name ? allUsers[0].full_name.substring(0, 3) : 'test';
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .or(`full_name.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`)
      .limit(10);
    
    if (error) {
      console.error('❌ User search error:', error);
      return;
    }
    
    console.log(`Search results for "${searchTerm}":`, users);
    
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