const { User, RideRequest } = require('../model/index');
const matchingService = require('../services/matchingService'); 
const mongoose = require('mongoose'); 
const { emitToConversation } = require('../socketManager'); 

const MAX_DAILY_REQUESTS = 50; //number of rides a user can create in a day

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

        // --- MODIFIED: Time Slot Validation ---
        const now = new Date();
        const departure = new Date(departureTime);

        // Check if parsing failed or date is invalid
        if (isNaN(departure.getTime())) {
             return res.status(400).json({
                success: false,
                message: 'Invalid departure time format provided.'
            });
        }

        // Check if time is in the past
        if (departure <= now) {
             return res.status(400).json({
                success: false,
                message: 'Departure time must be in the future.'
            });
        }

        // Check for allowed time slots (minutes 00 or 30, seconds/ms 0)
        const minutes = departure.getMinutes();
        const seconds = departure.getSeconds();
        const milliseconds = departure.getMilliseconds();

        if (![0, 30].includes(minutes) || seconds !== 0 || milliseconds !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid departure time slot. Please select a time ending in :00 or :30.'
            });
        }
        // --- END MODIFIED: Time Slot Validation ---

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

        // --- MODIFIED: Check for active ride request with existence validation ---
        if (user.currentRideRequest) {
            // Verify if the referenced ride request actually exists
            const existingRide = await RideRequest.findById(user.currentRideRequest).lean(); // Use lean for efficiency

            if (existingRide) {
                // Only block if the referenced ride *actually exists*
                return res.status(409).json({
                    success: false,
                    message: 'You already have an active ride request. Please cancel it before creating a new one.'
                });
            } else {
                // Data inconsistency found: User has a reference, but ride doesn't exist.
                console.warn(`Data inconsistency: Clearing invalid currentRideRequest ${user.currentRideRequest} for user ${userId}`);
                user.currentRideRequest = null; // Clear the invalid reference
                // No need to await here, will be saved later if creation proceeds
            }
        }
        // --- END MODIFIED ---

        // Check daily request limit
        user.resetDailyCountIfNeeded();
        if (user.requestCount.count >= MAX_DAILY_REQUESTS) {
            return res.status(429).json({
                success: false,
                message: `Daily ride request limit (${MAX_DAILY_REQUESTS}) reached. Please try again tomorrow.`
            });
        }

        // Create the new ride request
        // Ensure seconds/ms are zeroed before saving, even if validation passed (belt and suspenders)
        departure.setSeconds(0, 0);
        const newRideRequest = new RideRequest({
            userId,
            destination,
            departureTime: departure // Use the validated and potentially normalized Date object
        });
        await newRideRequest.save();

        // Update user's request count and link the new ride
        user.incrementRequestCount();
        user.currentRideRequest = newRideRequest._id;
        await user.save(); // This save will also persist the cleared reference if inconsistency was found

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

        // --- FIX: Return 200 OK with null data if no ride request exists ---
        if (!user.currentRideRequest) {
            return res.status(200).json({
                success: true,
                rideRequest: null // Indicate no active ride found
            });
        }
        // --- END FIX ---

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
    let affectedConversations = []; // Store affected conv IDs and counterpart ride IDs

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

                            // --- Store info for emission ---
                            affectedConversations.push({
                                conversationId: convRef.conversationId,
                                counterpartRideId: counterpartRide._id,
                                counterpartRideStatus: counterpartRide.status // Status after update
                            });
                            // --- End Store ---
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

        // --- Emit WebSocket Events After Successful Transaction & Deletion ---
        affectedConversations.forEach(affected => {
            emitToConversation(affected.conversationId, 'conversationUpdate', {
                conversationId: affected.conversationId,
                // Indicate one ride was deleted, counterpart status updated
                rideAStatus: 'Deleted', // Or some indicator
                rideBStatus: affected.counterpartRideStatus,
                conversationStatusA: 'declined', // Status from deleted ride's perspective
                conversationStatusB: 'declined'  // Status from counterpart's perspective
            });
             // OR emit a more specific event like 'rideDeletedFromConversation'
             // emitToConversation(affected.conversationId, 'rideDeletedFromConversation', {
             //     conversationId: affected.conversationId,
             //     deletedRideId: rideRequestIdToDelete,
             //     remainingRideId: affected.counterpartRideId,
             //     remainingRideStatus: affected.counterpartRideStatus
             // });
        });
        // --- End Emit ---

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
        const potentialMatchIds = await matchingService.findPotentialMatches(userRideRequest); // Assuming service returns IDs or minimal docs

        // --- FIX: Populate user details for the matches ---
        // Fetch the full RideRequest documents for the matches and populate user details
        const matches = await RideRequest.find({
            '_id': { $in: potentialMatchIds } // Find rides whose IDs are in the potentialMatchIds array
        }).populate({
            path: 'userId', // Field to populate
            select: 'displayName avatarUrl' // Select only the fields needed by the frontend
        }).lean(); // Use lean for performance if no Mongoose methods needed after this
        // --- END FIX ---

        // 4. Return the results (now with populated user details)
        return res.status(200).json({
            success: true,
            message: `Found ${matches.length} potential matches.`,
            matches: matches // Send the populated matches array
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
    getCurrentRideRequest, // Ensure this function is exported
    deleteRideRequest, // Ensure the modified function is exported
    findMatchesForCurrentRide
};
