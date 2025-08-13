#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('🔧 Fixing inconsistent token keys...');

// Find all files with localStorage.getItem('auth_token')
const files = execSync(`grep -r "localStorage.getItem('auth_token')" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | grep -v node_modules | cut -d: -f1 | sort -u`, { encoding: 'utf8' }).trim().split('\n').filter(f => f);

console.log(`📁 Found ${files.length} files with inconsistent token keys:`);
files.forEach(file => console.log(`   - ${file}`));

let fixedCount = 0;

files.forEach(file => {
  try {
    const content = readFileSync(file, 'utf8');
    const newContent = content.replace(/localStorage\.getItem\('token'\)/g, "localStorage.getItem('auth_token')");
    
    if (content !== newContent) {
      writeFileSync(file, newContent);
      console.log(`✅ Fixed: ${file}`);
      fixedCount++;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${file}:`, error.message);
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files with inconsistent token keys!`);
console.log('✅ All files now use "auth_token" consistently.');