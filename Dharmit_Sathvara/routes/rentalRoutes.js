const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const authenticateUser = require('../middleware/auth');

// All rental routes are protected with Supabase JWT
router.use(authenticateUser);

// POST /api/rentals - Book a vehicle with date collision check and dynamic billing
router.post('/', rentalController.bookRental);

// GET /api/rentals/my-bookings - List current user's bookings
router.get('/my-bookings', rentalController.getMyBookings);

// PATCH /api/rentals/:id/cancel - Cancel upcoming booking and release vehicle
router.patch('/:id/cancel', rentalController.cancelRental);

// PATCH /api/rentals/:id/complete - Complete rental and return vehicle to available
router.patch('/:id/complete', rentalController.completeRental);

module.exports = router;
