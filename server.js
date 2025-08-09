import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

// Load environment variables - check multiple sources
dotenv.config({ path: '.env.local' }); // For local development
dotenv.config(); // For .env file
// Environment variables set directly in the system (like Coolify) will override these

// Debug environment variables
console.log('🔍 Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('PORT:', process.env.PORT || 'not set');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'NOT SET');
console.log('BCRYPT_ROUNDS:', process.env.BCRYPT_ROUNDS || 'not set (will use default 12)');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - disabled HTTPS redirect for local development
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now to avoid mixed content issues
  hsts: false, // Disable HTTPS redirect
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['https://prohappya.uk']) // Use env var or fallback
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes (using dynamic import for ES modules)
try {
  console.log('📦 Loading routes...');
  const { default: authRoutes } = await import('./routes/auth.js');
  const { default: projectRoutes } = await import('./routes/projects.js');
  const { default: notificationRoutes } = await import('./routes/notifications.js');
  const { default: fileRoutes } = await import('./routes/files.js');
  const { default: userRoutes } = await import('./routes/users.js');
  console.log('✅ All routes loaded successfully');
  
  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/users', userRoutes);
  console.log('✅ All routes mounted successfully');
} catch (error) {
  console.error('❌ Failed to load routes:', error);
  process.exit(1);
}

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add cache-busting headers for HTML files
app.use((req, res, next) => {
  if (req.url.endsWith('.html') || req.url === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Check if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('ERROR: dist directory not found at', distPath);
  process.exit(1);
}

console.log('Dist directory contents:', fs.readdirSync(distPath));

// Serve static files from dist directory
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    console.log('Serving file:', filePath);

    // Disable HTTPS redirect headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    // Set proper MIME types and cache headers
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache'); // Disable caching for debugging
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache'); // Disable caching for debugging
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('sw.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Routes are now mounted in the try block above

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'NOT SET'
    }
  });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Test endpoint to check if API is working
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');

  console.log('Fallback route hit for:', req.url);

  // Check if the requested file exists in dist
  const requestedFile = path.join(__dirname, 'dist', req.path);

  if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
    console.log('Serving existing file:', requestedFile);
    return res.sendFile(requestedFile);
  }

  // File doesn't exist, serve index.html for SPA routing
  if (fs.existsSync(indexPath)) {
    console.log('Serving index.html for SPA routing');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(indexPath);
  } else {
    console.error('index.html not found at:', indexPath);
    res.status(404).send('Application not found');
  }
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Health check available at: http://localhost:${PORT}/health`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});