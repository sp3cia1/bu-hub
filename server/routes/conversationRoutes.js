const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
    initiateConversation,
    getConversationsForCurrentRide, // Import new controller functions
    getMessagesForConversation,
    sendMessage,
    confirmRide,
    declineConversation
} = require('../controller/conversationController');

const router = express.Router();

// All conversation routes require authentication
router.use(authenticate);

// GET /api/conversations - Get conversations for the current user's active ride
router.get('/', getConversationsForCurrentRide);

// POST /api/conversations - Initiate a new conversation
// Body requires: { "targetRideId": "..." }
router.post('/', initiateConversation);

// GET /api/conversations/:conversationId/messages - Get messages for a specific conversation
router.get('/:conversationId/messages', getMessagesForConversation);

// POST /api/conversations/:conversationId/messages - Send a message
// Body requires: { "content": "..." }
router.post('/:conversationId/messages', sendMessage);

// POST /api/conversations/:conversationId/confirm - Confirm the ride share
router.post('/:conversationId/confirm', confirmRide);

// POST /api/conversations/:conversationId/decline - Decline the conversation
router.post('/:conversationId/decline', declineConversation);

module.exports = router;
