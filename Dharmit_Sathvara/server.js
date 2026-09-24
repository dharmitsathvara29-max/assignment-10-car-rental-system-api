require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const rentalRoutes = require('./routes/rentalRoutes');

// Import error handler
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check & Root Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Car Rental & Fleet Booking System API',
    version: '1.0.0',
    documentation: {
      auth: '/api/auth',
      vehicles: '/api/vehicles',
      rentals: '/api/rentals',
    },
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Mount API Routers
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/rentals', rentalRoutes);

// Catch-all 404 Handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
});

// Centralized Error Handling Middleware (must be mounted last)
app.use(errorHandler);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Car Rental API server running on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = Number(PORT) === 5000 ? 5001 : Number(PORT) + 1;
      console.warn(`⚠️  Port ${PORT} is in use (common with macOS AirPlay receiver). Switching to port ${fallbackPort}...`);
      app.listen(fallbackPort, () => {
        console.log(`🚀 Car Rental API server running on fallback port ${fallbackPort}`);
        console.log(`📡 URL: http://localhost:${fallbackPort}`);
      });
    } else {
      console.error('Server error:', err);
    }
  });
}

module.exports = app;
