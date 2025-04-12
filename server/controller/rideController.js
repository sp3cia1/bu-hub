const { User, RideRequest } = require('../model/index');
const matchingService = require('../services/matchingService'); // Import the service

const MAX_DAILY_REQUESTS = 5; //number of rides a user can create in a day

// Controller to create a new ride request
const createRideRequest = async (req, res) => {
    try {
        const { destination, departureTime } = req.body;
        const userId = req.user._id; // User ID from authenticate middleware

        if (!destination || !departureTime) {
            return res.status(400).json({
                success: false,
                message: 'Destination and departure time are required.'
            });
        }

        //check if departure time is not in past
        const now = new Date();
        const departure = new Date(departureTime);
        if (isNaN(departure.getTime()) || departure <= now) { 
             return res.status(400).json({
                success: false,
                message: 'Invalid or past departure time provided.'
            });
        }

        // Validate destination against schema enum (Mongoose handles this on save, but early check is good)
        const allowedDestinations = RideRequest.schema.path('destination').enumValues;
        if (!allowedDestinations.includes(destination)) {
             return res.status(400).json({
                success: false,
                message: `Invalid destination. Allowed destinations are: ${allowedDestinations.join(', ')}`
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            // this Should not happen if authenticate middleware works, but here for good practice
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Check if user already has an active ride request
        if (user.currentRideRequest) {
            return res.status(409).json({
                success: false,
                message: 'You already have an active ride request. Please cancel it before creating a new one.'
            });
        }

        // Check daily request limit
        user.resetDailyCountIfNeeded();
        if (user.requestCount.count >= MAX_DAILY_REQUESTS) {
            return res.status(429).json({
                success: false,
                message: `Daily ride request limit (${MAX_DAILY_REQUESTS}) reached. Please try again tomorrow.`
            });
        }

        // Create the new ride request
        const newRideRequest = new RideRequest({
            userId,
            destination,
            departureTime: departure // Use the validated Date object
        });
        await newRideRequest.save();

        // Update user's request count and link the new ride
        user.incrementRequestCount();
        user.currentRideRequest = newRideRequest._id;
        await user.save();

        return res.status(201).json({
            success: true,
            message: 'Ride request created successfully.',
            rideRequest: newRideRequest
        });

    } catch (error) {
        console.error('Error creating ride request:', error);
        // Handle potential validation errors from Mongoose
        if (error.name === 'ValidationError') {
             return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to create ride request due to server error.'
        });
    }
};

// Controller to get the user's current active ride request
const getCurrentRideRequest = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find user and populate their current ride request details
        const user = await User.findById(userId).populate('currentRideRequest');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (!user.currentRideRequest) {
            return res.status(404).json({
                success: false,
                message: 'No active ride request found.'
            });
        }

        return res.status(200).json({
            success: true,
            rideRequest: user.currentRideRequest
        });

    } catch (error) {
        console.error('Error fetching current ride request:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch ride request due to server error.'
        });
    }
};

// Controller to delete/cancel the user's current active ride request
const deleteRideRequest = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const rideRequestId = user.currentRideRequest;
        if (!rideRequestId) {
            return res.status(404).json({
                success: false,
                message: 'No active ride request found to delete.'
            });
        }

        // Unlink the ride request from the user first
        user.currentRideRequest = null;
        await user.save();

        // Then delete the ride request document
        const deletedRide = await RideRequest.findByIdAndDelete(rideRequestId);

        if (!deletedRide) {
            // This might happen in a rare race condition, but good to handle
             console.warn(`Ride request ${rideRequestId} not found during deletion attempt for user ${userId}.`);
             // Still return success as the user link is removed.
        }

        return res.status(200).json({
            success: true,
            message: 'Active ride request cancelled successfully.'
        });

    } catch (error) {
        console.error('Error deleting ride request:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel ride request due to server error.'
        });
    }
};

// Controller to find potential matches for the user's current ride
const findMatchesForCurrentRide = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Get the user's current active ride request ID
        const user = await User.findById(userId).select('currentRideRequest').lean(); // Use lean for performance
        if (!user || !user.currentRideRequest) {
            return res.status(404).json({
                success: false,
                message: 'You do not have an active ride request to find matches for.'
            });
        }

        // 2. Fetch the full ride request document
        const userRideRequest = await RideRequest.findById(user.currentRideRequest);
        if (!userRideRequest) {
             // Data inconsistency: User has an ID but the ride doesn't exist
             console.error(`Data inconsistency: RideRequest ${user.currentRideRequest} not found for user ${userId}`);
             // Clear the inconsistent link (optional self-healing)
             // await User.findByIdAndUpdate(userId, { $unset: { currentRideRequest: "" } });
             return res.status(404).json({
                success: false,
                message: 'Your active ride request could not be found. Please create a new one.'
             });
        }

        // 3. Call the matching service
        const matches = await matchingService.findPotentialMatches(userRideRequest);

        // 4. Return the results
        return res.status(200).json({
            success: true,
            message: `Found ${matches.length} potential matches.`,
            matches: matches
        });

    } catch (error) {
        console.error('Error finding matches for current ride:', error);
        // Handle errors potentially thrown by the service layer
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to find matches due to a server error.'
        });
    }
};


module.exports = {
    createRideRequest,
    getCurrentRideRequest,
    deleteRideRequest,
    findMatchesForCurrentRide // Export the new function
};
