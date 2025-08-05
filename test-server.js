#!/usr/bin/env node

// Simple test server to verify static file serving
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DIST_DIR = path.join(__dirname, 'dist');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    // For SPA, serve index.html for non-asset routes
    if (!req.url.startsWith('/assets/') && !req.url.includes('.')) {
      filePath = path.join(DIST_DIR, 'index.html');
    } else {
      res.writeHead(404);
      res.end('File not found');
      return;
    }
  }
  
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log('Test these URLs:');
  console.log(`- http://localhost:${PORT}/`);
  console.log(`- http://localhost:${PORT}/assets/index-B-PIN1lv.css`);
  console.log(`- http://localhost:${PORT}/assets/index-2SF1YFop.js`);
});