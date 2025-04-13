const { User, RideRequest, Conversation } = require('../model/index');
const mongoose = require('mongoose');

const CONVERSATION_EXPIRY_BUFFER_HOURS = 2; // Conversation expires 2 hours after the ride departs

// Controller to initiate a conversation between two ride requests
const initiateConversation = async (req, res) => {
    const { targetRideId } = req.body;
    const initiatorUserId = req.user._id; // From authenticate middleware

    if (!targetRideId || !mongoose.Types.ObjectId.isValid(targetRideId)) {
        return res.status(400).json({ success: false, message: 'Valid targetRideId is required.' });
    }

    const session = await mongoose.startSession(); // Use transaction for atomicity

    try {
        let newConversationDoc;
        let initiatorRide;
        let targetRide;

        await session.withTransaction(async () => {
            // fetch initiator user's data and their active ride request ID
            const initiatorUser = await User.findById(initiatorUserId).select('currentRideRequest').session(session);
            if (!initiatorUser || !initiatorUser.currentRideRequest) {
                throw { status: 404, message: 'You do not have an active ride request.' };
            }
            const initiatorRideId = initiatorUser.currentRideRequest;

            if (initiatorRideId.toString() === targetRideId) {
                 throw { status: 400, message: 'Cannot initiate a conversation with your own ride request.' };
            }

            // fetch both ride requests (initiator's and target's) and lock them
            initiatorRide = await RideRequest.findById(initiatorRideId).session(session);
            targetRide = await RideRequest.findById(targetRideId).session(session);

            if (!initiatorRide || !targetRide) {
                throw { status: 404, message: 'One or both ride requests could not be found.' };
            }

            // check statuses - both must be 'Available'
            if (initiatorRide.status !== 'Available' || targetRide.status !== 'Available') {
                throw { status: 409, message: 'One or both ride requests are not available for matching (might be Pending or Confirmed).' };
            }

            // check if a conversation already exists between these two rides
            const existingConversation = await Conversation.findOne({
                $or: [
                    { rideRequestA: initiatorRideId, rideRequestB: targetRideId },
                    { rideRequestA: targetRideId, rideRequestB: initiatorRideId }
                ]
            }).session(session);

            if (existingConversation) {
                throw { status: 409, message: 'A conversation already exists or is pending between these ride requests.' };
            }

            // determine conversation expiry time (based on the EARLIER departure time)
            const earlierDepartureTime = initiatorRide.departureTime < targetRide.departureTime
                ? initiatorRide.departureTime
                : targetRide.departureTime;
            const expiresAt = new Date(earlierDepartureTime.getTime() + CONVERSATION_EXPIRY_BUFFER_HOURS * 60 * 60 * 1000);

            // create the Conversation document
            newConversationDoc = new Conversation({
                rideRequestA: initiatorRideId,
                rideRequestB: targetRideId,
                messages: [], // start with empty messages
                expiresAt: expiresAt
            });
            await newConversationDoc.save({ session });

            // update both RideRequest documents
            const conversationEntry = {
                rideId: null, // will be set below
                status: 'pending',
                conversationId: newConversationDoc._id
            };

            // update initiator's ride
            initiatorRide.status = 'Pending';
            initiatorRide.conversations.push({ ...conversationEntry, rideId: targetRideId });

            // Update target's ride
            targetRide.status = 'Pending';
            targetRide.conversations.push({ ...conversationEntry, rideId: initiatorRideId });

            await initiatorRide.save({ session });
            await targetRide.save({ session });

        }); // Transaction ends here

        await session.endSession();

        // Return the newly created conversation details
        return res.status(201).json({
            success: true,
            message: 'Conversation initiated successfully. Both ride requests are now Pending.',
            conversation: newConversationDoc, // Send the created conversation back
            initiatorRideStatus: initiatorRide.status, // Confirm status change
            targetRideStatus: targetRide.status      // Confirm status change
        });

    } catch (error) {
        await session.endSession();
        console.error('Error initiating conversation:', error);
        // Use status from thrown error if available, otherwise default to 500
        const statusCode = error.status || 500;
        const message = error.message || 'Failed to initiate conversation due to a server error.';
        return res.status(statusCode).json({ success: false, message: message });
    }
};

module.exports = {
    initiateConversation
};
