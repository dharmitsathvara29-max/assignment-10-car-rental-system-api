const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const authenticateUser = require('../middleware/auth');

// Public routes
// GET /api/vehicles - List all vehicles with optional ?category=&status= filters
router.get('/', vehicleController.getAllVehicles);

// GET /api/vehicles/:id - Vehicle details with rental history
router.get('/:id', vehicleController.getVehicleById);

// Protected routes (require valid Supabase Bearer token)
// POST /api/vehicles - Add vehicle
router.post('/', authenticateUser, vehicleController.createVehicle);

// PUT /api/vehicles/:id - Update vehicle rate/status
router.put('/:id', authenticateUser, vehicleController.updateVehicle);

// DELETE /api/vehicles/:id - Delete vehicle
router.delete('/:id', authenticateUser, vehicleController.deleteVehicle);

module.exports = router;
