const express = require('express');
const { handleRegistration, handleLogin } = require('../controller/authController');

const router = express.Router();

// POST /api/auth/register
router.post('/register', handleRegistration);

// POST /api/auth/login
router.post('/login', handleLogin);

module.exports = router;
