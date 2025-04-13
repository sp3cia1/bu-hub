const express = require('express');
const { authenticate } = require('../middleware/auth');
const { initiateConversation } = require('../controller/conversationController');

const router = express.Router();

// All conversation routes require authentication
router.use(authenticate);

// POST /api/conversations - Initiate a new conversation
// Body requires: { "targetRideId": "..." }
router.post('/', initiateConversation);

// Future routes for getting conversations, sending messages, etc. will go here

module.exports = router;
