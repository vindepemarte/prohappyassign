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

// Enhanced environment variable validation
console.log('🔍 Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('PORT:', process.env.PORT || 'not set');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'NOT SET');
console.log('BCRYPT_ROUNDS:', process.env.BCRYPT_ROUNDS || 'not set (will use default 12)');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'not set (will use fallback)');

// Validate critical environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  console.error('📋 Please check PRODUCTION_ENV_SETUP.md for configuration guide');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
} else {
  console.log('✅ All required environment variables are set');
}

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

// Enhanced CORS configuration for production deployment
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          process.env.FRONTEND_URL,
          'https://prohappya.uk',
          'https://www.prohappya.uk',
          'https://prohappyassignments.com',
          'https://www.prohappyassignments.com',
          // Allow same-origin requests (when frontend and backend are on same domain)
          origin
        ].filter(Boolean)
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5432', 
          'http://127.0.0.1:3000',
          'http://localhost:5173', // Vite dev server
          origin // Allow any origin in development
        ];

    console.log('🔍 CORS check - Origin:', origin, 'Allowed:', allowedOrigins);
    
    // In production, be more permissive for same-origin requests
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production' || !origin) {
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  console.log('🔄 Preflight request for:', req.url);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes and error handling (using dynamic import for ES modules)
try {
  console.log('📦 Loading routes and middleware...');
  const { errorHandler } = await import('./middleware/errorHandler.js');
  const { default: authRoutes } = await import('./routes/auth.js');
  const { default: projectRoutes } = await import('./routes/projects.js');
  const { default: notificationRoutes } = await import('./routes/notifications.js');
  const { default: fileRoutes } = await import('./routes/files.js');
  const { default: userRoutes } = await import('./routes/users.js');
  const { default: referenceCodeRoutes } = await import('./routes/referenceCodes.js');
  const { default: hierarchyRoutes } = await import('./routes/hierarchy.js');
  const { default: permissionRoutes } = await import('./routes/permissions.js');
  const { default: agentPricingRoutes } = await import('./routes/agentPricing.js');
  const { default: financialSecurityRoutes } = await import('./routes/financialSecurity.js');
  const { default: projectAssignmentRoutes } = await import('./routes/projectAssignment.js');
  const { default: hierarchyOperationsRoutes } = await import('./routes/hierarchyOperations.js');
  const { default: apiDocumentationRoutes } = await import('./routes/apiDocumentation.js');
  const { default: pricingRoutes } = await import('./routes/pricing.js');
  const { default: analyticsRoutes } = await import('./routes/analytics.js');
  console.log('✅ All routes loaded successfully');
  
  // API routes with debugging
  console.log('🔧 Mounting API routes...');
  app.use('/api/auth', (req, res, next) => {
    console.log(`🔐 Auth route: ${req.method} ${req.url}`);
    next();
  }, authRoutes);
  
  app.use('/api/projects', projectRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/reference-codes', referenceCodeRoutes);
  app.use('/api/hierarchy', hierarchyRoutes);
  app.use('/api/permissions', permissionRoutes);
  app.use('/api/agent-pricing', agentPricingRoutes);
  app.use('/api/financial-security', financialSecurityRoutes);
  app.use('/api/project-assignment', projectAssignmentRoutes);
  app.use('/api/hierarchy-operations', hierarchyOperationsRoutes);
  app.use('/api/docs', apiDocumentationRoutes);
  app.use('/api/pricing', pricingRoutes);
  app.use('/api/analytics', analyticsRoutes);
  console.log('✅ All routes mounted successfully');
  
  // Test that auth routes are working
  console.log('🧪 Testing auth route mounting...');
  console.log('Auth routes should be available at: /api/auth/login, /api/auth/register, /api/auth/me');
  
  // Add centralized error handling middleware
  app.use(errorHandler);
  
  // Catch-all handler for unmatched API routes
  app.use('/api/*', (req, res) => {
    console.log(`❌ Unmatched API route: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: 'API endpoint not found',
      method: req.method,
      path: req.url,
      timestamp: new Date().toISOString()
    });
  });
} catch (error) {
  console.error('❌ Failed to load routes:', error);
  process.exit(1);
}

// Add request logging and debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
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

// SPA fallback - serve index.html for all other routes (but NOT API routes)
app.get('*', (req, res) => {
  // CRITICAL: Don't serve SPA for API routes
  if (req.url.startsWith('/api/')) {
    console.log('❌ API route hit SPA fallback - this should not happen:', req.url);
    return res.status(404).json({ 
      error: 'API endpoint not found',
      path: req.url,
      method: req.method
    });
  }

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