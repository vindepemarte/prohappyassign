import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

const testUsers = [
  { full_name: 'Test Client', email: 'client@test.com', password: 'password123', role: 'client' },
  { full_name: 'Test Worker', email: 'worker@test.com', password: 'password123', role: 'worker' },
  { full_name: 'Test Agent', email: 'agent@test.com', password: 'password123', role: 'agent' }
];

async function setupUsers() {
  console.log('🔧 Setting up test users...\n');
  
  for (const user of testUsers) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/register`, user);
      console.log(`✅ ${user.role} registered: ${user.email}`);
    } catch (error) {
      if (error.response?.data?.error?.includes('already exists')) {
        console.log(`ℹ️  ${user.role} already exists: ${user.email}`);
      } else {
        console.log(`❌ ${user.role} registration failed:`, error.response?.data || error.message);
      }
    }
  }
  
  console.log('\n✅ Test users setup complete!\n');
}

setupUsers().catch(console.error);