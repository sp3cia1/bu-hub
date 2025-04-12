const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
    createRideRequest,
    getCurrentRideRequest,
    deleteRideRequest,
    findMatchesForCurrentRide
} = require('../controller/rideController');

const router = express.Router();

// All ride routes require authentication
router.use(authenticate);

// POST /api/rides - Create a new ride request
router.post('/', createRideRequest);

// GET /api/rides/current - Get the current user's active ride request
router.get('/current', getCurrentRideRequest);

// DELETE /api/rides/current - Delete the current user's active ride request
router.delete('/current', deleteRideRequest);

// GET /api/rides/current/matches - Find potential matches for the current ride
router.get('/current/matches', findMatchesForCurrentRide);

module.exports = router;
