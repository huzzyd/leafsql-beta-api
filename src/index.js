const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const { createSupabaseClient, testConnection } = require('./config/supabase');
const { authenticateRequest } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const databaseService = require('./services/database');
const queryRoutes = require('./routes/query');
const workspaceRoutes = require('./routes/workspace');
const queryHistoryRoutes = require('./routes/queryHistory');

const app = express();
const PORT = config.PORT;

// Middleware
app.use(helmet());

// CORS configuration with wildcard support
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin matches exact allowed origins
    if (config.ALLOWED_ORIGINS_ARRAY.includes(origin)) {
      return callback(null, true);
    }

    // Check wildcard patterns for Lovable domains
    const lovablePatterns = [
      /^https:\/\/.*\.lovable\.app$/,
      /^https:\/\/.*\.lovableproject\.com$/
    ];

    const isLovableDomain = lovablePatterns.some(pattern => pattern.test(origin));
    if (isLovableDomain) {
      return callback(null, true);
    }

    // Origin not allowed
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes - IMPORTANT: More specific routes MUST come before general routes
// Otherwise /api/query will catch /api/query/history requests
app.use('/api/query/history', authenticateRequest, queryHistoryRoutes);  // SPECIFIC route first
app.use('/api/query', authenticateRequest, queryRoutes);                 // GENERAL route second
app.use('/api/workspaces', authenticateRequest, workspaceRoutes);

// Global error handler (MUST BE LAST)
app.use(errorHandler);

// Initialize Supabase client
let supabaseClient;
try {
  supabaseClient = createSupabaseClient();
  console.log('🔗 Supabase connected');
} catch (error) {
  console.error('❌ Supabase connection failed:', error.message);
  process.exit(1);
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  
  // Test Supabase connection
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      console.log('✅ Supabase connection verified');
    }
  } catch (error) {
    console.log('⚠️  Supabase connection test error:', error.message);
  }
  
  console.log('✅ All services initialized');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  try {
    // Close all database connection pools
    await databaseService.closeAllPools();
    console.log('✅ Database pools closed');
    
    // Exit process
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
});

module.exports = app;