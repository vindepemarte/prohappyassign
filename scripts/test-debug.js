#!/usr/bin/env node

import fetch from 'node-fetch';

async function testDebug() {
  try {
    console.log('🧪 Testing debug endpoint...');
    const response = await fetch('http://localhost:3000/api/auth/debug');
    const data = await response.json();
    
    console.log('✅ Debug endpoint response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Debug endpoint failed:', error.message);
  }
}

testDebug();