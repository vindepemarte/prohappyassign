/**
 * Fix bcrypt installation
 * Rebuilds bcrypt native bindings
 */

import { spawn } from 'child_process';

const fixBcrypt = async () => {
  console.log('🔧 Fixing bcrypt installation...');
  
  const commands = [
    ['npm', ['rebuild', 'bcrypt']],
    ['npm', ['install', 'bcrypt', '--force']],
  ];
  
  for (const [cmd, args] of commands) {
    console.log(`Running: ${cmd} ${args.join(' ')}`);
    
    try {
      await new Promise((resolve, reject) => {
        const process = spawn(cmd, args, { stdio: 'inherit' });
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Command failed with code ${code}`));
          }
        });
        
        process.on('error', reject);
      });
      
      console.log('✅ Command completed successfully');
      break; // If one command succeeds, we're done
      
    } catch (error) {
      console.log(`⚠️  Command failed: ${error.message}`);
      console.log('Trying next approach...');
    }
  }
  
  console.log('\n💡 If bcrypt still doesn\'t work, try:');
  console.log('   npm uninstall bcrypt');
  console.log('   npm install bcrypt');
  console.log('   or use: npm install bcrypt --build-from-source');
};

fixBcrypt();