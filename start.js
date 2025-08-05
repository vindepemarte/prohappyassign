#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting ProHappyAssignments...');
console.log('📁 Current directory:', __dirname);
console.log('🔍 Checking environment...');

// Check Node.js version
console.log('📦 Node.js version:', process.version);

// Check if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ ERROR: dist directory not found at', distPath);
  console.log('📂 Available files:', fs.readdirSync(__dirname));
  process.exit(1);
}

console.log('✅ dist directory found');
console.log('📂 dist contents:', fs.readdirSync(distPath));

// Check if index.html exists
const indexPath = path.join(distPath, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('❌ ERROR: index.html not found');
  process.exit(1);
}

console.log('✅ index.html found');

// Check if assets directory exists
const assetsPath = path.join(distPath, 'assets');
if (fs.existsSync(assetsPath)) {
  console.log('✅ assets directory found');
  console.log('📂 assets contents:', fs.readdirSync(assetsPath));
} else {
  console.warn('⚠️  WARNING: assets directory not found');
}

// Check if server.js exists
const serverPath = path.join(__dirname, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('❌ ERROR: server.js not found');
  process.exit(1);
}

console.log('✅ server.js found');

// Check package.json
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log('📦 Package name:', pkg.name);
  console.log('📦 Package version:', pkg.version);
  
  // Check if express is in dependencies
  if (pkg.dependencies && pkg.dependencies.express) {
    console.log('✅ Express found in dependencies:', pkg.dependencies.express);
  } else {
    console.error('❌ ERROR: Express not found in dependencies');
    process.exit(1);
  }
}

console.log('🎯 All checks passed, starting server...');

// Import and start the server
import('./server.js').catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});