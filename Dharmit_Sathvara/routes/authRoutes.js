const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/register - Register a new customer
router.post('/register', authController.register);

// POST /api/auth/login - Login customer and get JWT token
router.post('/login', authController.login);

module.exports = router;
