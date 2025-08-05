import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Deployment Verification ===');

// Check if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ FAIL: dist directory not found');
  process.exit(1);
}
console.log('✅ dist directory exists');

// Check if index.html exists
const indexPath = path.join(distPath, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('❌ FAIL: index.html not found');
  process.exit(1);
}
console.log('✅ index.html exists');

// Check if assets directory exists
const assetsPath = path.join(distPath, 'assets');
if (!fs.existsSync(assetsPath)) {
  console.error('❌ FAIL: assets directory not found');
  process.exit(1);
}
console.log('✅ assets directory exists');

// List assets
const assets = fs.readdirSync(assetsPath);
console.log('📁 Assets found:', assets);

// Read index.html and extract asset references
const indexContent = fs.readFileSync(indexPath, 'utf8');
const jsMatch = indexContent.match(/src="\/assets\/(index-[^"]+\.js)"/);
const cssMatch = indexContent.match(/href="\/assets\/(index-[^"]+\.css)"/);
const manifestMatch = indexContent.match(/href="\/assets\/(manifest-[^"]+\.json)"/);

if (!jsMatch) {
  console.error('❌ FAIL: No JS file reference found in index.html');
  process.exit(1);
}

if (!cssMatch) {
  console.error('❌ FAIL: No CSS file reference found in index.html');
  process.exit(1);
}

if (!manifestMatch) {
  console.error('❌ FAIL: No manifest file reference found in index.html');
  process.exit(1);
}

const jsFile = jsMatch[1];
const cssFile = cssMatch[1];
const manifestFile = manifestMatch[1];

console.log('📄 Referenced files:');
console.log('  JS:', jsFile);
console.log('  CSS:', cssFile);
console.log('  Manifest:', manifestFile);

// Check if referenced files actually exist
const jsExists = fs.existsSync(path.join(assetsPath, jsFile));
const cssExists = fs.existsSync(path.join(assetsPath, cssFile));
const manifestExists = fs.existsSync(path.join(assetsPath, manifestFile));

if (!jsExists) {
  console.error(`❌ FAIL: Referenced JS file ${jsFile} not found`);
  process.exit(1);
}

if (!cssExists) {
  console.error(`❌ FAIL: Referenced CSS file ${cssFile} not found`);
  process.exit(1);
}

if (!manifestExists) {
  console.error(`❌ FAIL: Referenced manifest file ${manifestFile} not found`);
  process.exit(1);
}

console.log('✅ All referenced files exist');

// Check service worker
const swPath = path.join(distPath, 'sw.js');
if (!fs.existsSync(swPath)) {
  console.error('❌ FAIL: Service worker (sw.js) not found');
  process.exit(1);
}
console.log('✅ Service worker exists');

console.log('🎉 All deployment checks passed!');