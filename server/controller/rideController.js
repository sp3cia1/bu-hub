const { User, RideRequest } = require('../model/index');
const matchingService = require('../services/matchingService'); // Import the service
const mongoose = require('mongoose'); // Import mongoose

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

// --- MODIFIED Controller to delete/cancel the user's current active ride request ---
const deleteRideRequest = async (req, res) => {
    const userId = req.user._id;
    const session = await mongoose.startSession();
    let rideRequestIdToDelete = null;

    try {
        await session.withTransaction(async () => {
            // 1. Find user and get their current ride request ID
            const user = await User.findById(userId).session(session);
            if (!user) {
                // Should not happen with authenticate middleware, but good check
                throw { status: 404, message: 'User not found.' };
            }

            rideRequestIdToDelete = user.currentRideRequest;
            if (!rideRequestIdToDelete) {
                throw { status: 404, message: 'No active ride request found to delete.' };
            }

            // 2. Fetch the ride request to be deleted
            const rideToDelete = await RideRequest.findById(rideRequestIdToDelete).session(session);
            if (!rideToDelete) {
                // Ride ID exists on user but document is missing - data inconsistency
                console.warn(`Ride request ${rideRequestIdToDelete} referenced by user ${userId} not found. Clearing user reference.`);
                user.currentRideRequest = null;
                await user.save({ session });
                // Allow transaction to commit successfully, but inform client
                throw { status: 404, message: 'Active ride request reference was invalid and has been cleared. No ride deleted.' };
            }

            // 3. Process Counterpart Rides
            const conversationsToProcess = rideToDelete.conversations || [];
            for (const convRef of conversationsToProcess) {
                // Only process conversations that might affect other rides' states
                if (['pending', 'awaiting_confirmation', 'confirmed'].includes(convRef.status)) {
                    const counterpartRide = await RideRequest.findById(convRef.rideId).session(session);
                    if (counterpartRide) {
                        const counterpartConvRef = counterpartRide.conversations.find(c => c.conversationId.equals(convRef.conversationId));

                        // Check if counterpart reference exists and needs update
                        if (counterpartConvRef && counterpartConvRef.status !== 'declined') {
                            counterpartConvRef.status = 'declined'; // Mark as declined due to deletion

                            // Re-evaluate counterpart's overall status
                            const hasOtherActive = counterpartRide.conversations.some(
                                c => ['pending', 'awaiting_confirmation', 'confirmed'].includes(c.status) && !c.conversationId.equals(convRef.conversationId) // Exclude the one we just declined
                            );

                            // If no other active/confirmed conversations, and it wasn't already Available
                            if (!hasOtherActive && counterpartRide.status !== 'Available') {
                                counterpartRide.status = 'Available';
                            }
                            await counterpartRide.save({ session });
                        }
                    } else {
                        console.warn(`Counterpart ride ${convRef.rideId} not found during deletion cleanup for ride ${rideRequestIdToDelete}.`);
                    }
                }
            }

            // 4. Unlink the ride request from the user
            user.currentRideRequest = null;
            await user.save({ session });

            // Note: Actual deletion happens *after* the transaction commits

        }); // Transaction ends

        // 5. Perform the actual deletion *after* successful transaction
        if (rideRequestIdToDelete) {
            const deletedDoc = await RideRequest.findByIdAndDelete(rideRequestIdToDelete);
            if (!deletedDoc) {
                 console.warn(`Attempted to delete ride ${rideRequestIdToDelete} after transaction, but it was already gone.`);
            }
        }

        await session.endSession();
        return res.status(200).json({
            success: true,
            message: 'Active ride request cancelled successfully and related states updated.'
        });

    } catch (error) {
        await session.endSession();
        // If the error came from our thrown exceptions, use its status/message
        if (error.status) {
             return res.status(error.status).json({ success: false, message: error.message });
        }
        // Otherwise, handle generic errors
        console.error('Error deleting ride request:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to cancel ride request due to server error.'
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
    deleteRideRequest, // Ensure the modified function is exported
    findMatchesForCurrentRide
};
