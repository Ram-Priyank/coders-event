require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Root greeting
app.get('/', (req, res) => {
  res.json({
    message: 'Department Inventory & Student Item Issue Management API is live.',
    problemStatement: '#5 - Department Inventory and Student Item Issue Management System',
    documentation: '/api/health',
    endpoints: [
      '/api/stats',
      '/api/items',
      '/api/assets',
      '/api/locations',
      '/api/students',
      '/api/issues',
      '/api/renewals',
      '/api/reports',
      '/api/audit-logs'
    ]
  });
});

// Start Server
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Inventory Management Server listening on port ${PORT}`);
    console.log(`📡 Base API URL: http://localhost:${PORT}/api`);
    console.log(`====================================================`);
  });
}

start();
