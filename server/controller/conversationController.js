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

            // --- MODIFIED STATUS CHECK ---
            // 3. Check statuses: Initiator can be Available/Pending. Target must NOT be Confirmed.
            if (initiatorRide.status === 'Confirmed') {
                 throw { status: 409, message: 'Your ride request is already confirmed and cannot initiate new conversations.' };
            }
            if (targetRide.status === 'Confirmed') {
                throw { status: 409, message: 'The target ride request is already confirmed.' };
            }
            // --- END MODIFIED STATUS CHECK ---

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

            // Update initiator's ride status to Pending (if not already)
            if (initiatorRide.status === 'Available') {
                 initiatorRide.status = 'Pending';
            }
            initiatorRide.conversations.push({ ...conversationEntry, rideId: targetRideId });

            // Update target's ride status to Pending (if not already)
            if (targetRide.status === 'Available') {
                 targetRide.status = 'Pending';
            }
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

// Controller to get conversations related to the user's current ride
const getConversationsForCurrentRide = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Get the user's current active ride request ID
        const user = await User.findById(userId).select('currentRideRequest').lean();
        if (!user || !user.currentRideRequest) {
            return res.status(200).json({ success: true, conversations: [] });
        }

        // 2. Fetch the user's ride request and populate details
        const userRide = await RideRequest.findById(user.currentRideRequest)
            .populate({
                path: 'conversations.conversationId', // Populate the Conversation document
                model: 'Conversation',
                select: 'messages expiresAt rideRequestA rideRequestB', // Select necessary fields
                // Avoid deep population here if not strictly needed for this view
            })
            .populate({
                path: 'conversations.rideId', // Populate the other RideRequest document
                model: 'RideRequest',
                // --- MODIFIED: Select 'conversations' array from the other ride ---
                select: 'userId destination departureTime conversations',
                populate: { // Populate the user associated with the other ride
                    path: 'userId',
                    model: 'User',
                    select: 'email phoneNumber' // Select fields needed for display
                }
            })
            .lean(); // Use lean for performance

        if (!userRide) {
            console.warn(`Data inconsistency: RideRequest ${user.currentRideRequest} not found for user ${userId}`);
            return res.status(404).json({ success: false, message: 'Your active ride request could not be found.' });
        }

        // Filter/map the populated data for a cleaner response including both statuses
        const formattedConversations = userRide.conversations.map(conv => {
            const conversationDoc = conv.conversationId; // Populated Conversation
            const otherRideDoc = conv.rideId; // Populated other RideRequest (now includes its 'conversations' array)
            const myStatus = conv.status; // Status from the current user's perspective

            let otherPartyStatus = 'unknown'; // Default if not found
            if (otherRideDoc && otherRideDoc.conversations && conversationDoc) {
                // Find the corresponding conversation entry in the *other* ride's document
                const counterpartConvRef = otherRideDoc.conversations.find(
                    c => c.conversationId && c.conversationId.toString() === conversationDoc._id.toString()
                );
                if (counterpartConvRef) {
                    otherPartyStatus = counterpartConvRef.status;
                } else {
                     console.warn(`Could not find counterpart conversation ref for ${conversationDoc._id} in ride ${otherRideDoc._id}`);
                }
            } else {
                 console.warn(`Missing data needed to determine other party status for conversation ${conversationDoc?._id}`);
            }


            return {
                conversationId: conversationDoc?._id,
                otherRideId: otherRideDoc?._id,
                otherUser: {
                    _id: otherRideDoc?.userId?._id,
                    email: otherRideDoc?.userId?.email,
                    // phoneNumber: otherRideDoc?.userId?.phoneNumber, // Consider privacy
                },
                otherRideDetails: {
                    destination: otherRideDoc?.destination,
                    departureTime: otherRideDoc?.departureTime,
                },
                myStatus: myStatus, // e.g., 'awaiting_confirmation'
                otherPartyStatus: otherPartyStatus, // e.g., 'pending'
                // status: myStatus, // Keep original 'status' field? Maybe rename for clarity? Let's use myStatus/otherPartyStatus
                lastMessage: conversationDoc?.messages?.[conversationDoc.messages.length - 1],
                initiatedAt: conv.initiatedAt,
                expiresAt: conversationDoc?.expiresAt
            };
        });

        return res.status(200).json({
            success: true,
            conversations: formattedConversations
        });

    } catch (error) {
        console.error('Error fetching conversations:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch conversations.' });
    }
};

// Controller to get messages for a specific conversation
const getMessagesForConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({ success: false, message: 'Invalid conversation ID.' });
        }

        // Fetch the conversation
        const conversation = await Conversation.findById(conversationId)
            .populate('rideRequestA', 'userId') // Populate only userId to check participation
            .populate('rideRequestB', 'userId');

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found.' });
        }

        // Validate user participation
        const isParticipant = conversation.rideRequestA?.userId.equals(userId) ||
                              conversation.rideRequestB?.userId.equals(userId);

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'You are not authorized to view this conversation.' });
        }

        // Return messages (consider pagination for long conversations in future)
        return res.status(200).json({
            success: true,
            messages: conversation.messages
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
    }
};

// Controller to send a message in a conversation
const sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content } = req.body;
        const senderId = req.user._id; // User ID from authenticate middleware

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({ success: false, message: 'Invalid conversation ID.' });
        }
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
        }
        if (content.length > 500) { // Match schema validation
             return res.status(400).json({ success: false, message: 'Message content exceeds 500 characters.' });
        }

        // Fetch the conversation and validate participation
        // Use findOneAndUpdate for atomicity and efficiency
        const conversation = await Conversation.findById(conversationId)
            .populate('rideRequestA', 'userId')
            .populate('rideRequestB', 'userId');

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found.' });
        }

        // Validate user participation
        const isParticipant = conversation.rideRequestA?.userId.equals(senderId) ||
                              conversation.rideRequestB?.userId.equals(senderId);

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'You are not authorized to send messages in this conversation.' })
        }

        // Check if conversation has expired (optional, TTL index handles cleanup eventually)
        if (conversation.expiresAt && new Date() > conversation.expiresAt) {
             return res.status(410).json({ success: false, message: 'This conversation has expired.' });
        }

        // Check message limit before adding (though pre-save hook is the final guard)
        if (conversation.messages.length >= 20) {
             return res.status(409).json({ success: false, message: 'Message limit (20) reached for this conversation.' });
        }

        // Add the message
        const newMessage = {
            senderId: senderId,
            content: content.trim(),
            timestamp: new Date()
        };
        conversation.messages.push(newMessage);

        // Save the conversation (pre-save hook will handle trimming if needed)
        await conversation.save();

        // Return the newly added message
        return res.status(201).json({
            success: true,
            message: 'Message sent successfully.',
            sentMessage: newMessage // Return the message that was just added
        });

    } catch (error) {
        console.error('Error sending message:', error);
        if (error.name === 'ValidationError') { // Catch potential validation errors from save
             return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Failed to send message.' });
    }
};

// --- MODIFIED Helper function for transaction ---
// Processes other pending/awaiting conversations for a ride when one is mutually confirmed
async function processOtherPending(rideToProcess, mutuallyConfirmedConversationId, session) {
    let needsSave = false;
    const otherConversations = rideToProcess.conversations || [];

    for (const convRef of otherConversations) {
        // Skip the one just confirmed or ones already declined/confirmed
        if (convRef.conversationId.equals(mutuallyConfirmedConversationId) ||
            ['confirmed', 'declined'].includes(convRef.status)) {
            continue;
        }

        // Only process 'pending' or 'awaiting_confirmation'
        if (['pending', 'awaiting_confirmation'].includes(convRef.status)) {
            needsSave = true; // Mark rideToProcess as needing save
            convRef.status = 'declined'; // Decline this conversation reference

            // Now update the *other* ride involved in *this* declined conversation
            const otherRideInConv = await RideRequest.findById(convRef.rideId).session(session);
            if (otherRideInConv) {
                const counterpartConvRef = otherRideInConv.conversations.find(c => c.conversationId.equals(convRef.conversationId));
                // Check if counterpart exists and is not already finalized
                if (counterpartConvRef && ['pending', 'awaiting_confirmation'].includes(counterpartConvRef.status)) {
                    counterpartConvRef.status = 'declined';

                    // Check if the other ride should become Available
                    const hasOtherActive = otherRideInConv.conversations.some(c => ['pending', 'awaiting_confirmation'].includes(c.status));
                    if (!hasOtherActive && otherRideInConv.status === 'Pending') {
                        otherRideInConv.status = 'Available';
                    }
                    await otherRideInConv.save({ session }); // Save the counterpart ride
                }
            } else {
                console.warn(`Could not find counterpart ride ${convRef.rideId} to update during confirmation cleanup.`);
            }
        }
    }
    return needsSave; // Indicate if rideToProcess was modified
}
// --- End MODIFIED Helper ---


// --- MODIFIED Controller to confirm a ride share arrangement (Mutual Confirmation) ---
const confirmRide = async (req, res) => {
    const { conversationId } = req.params;
    const confirmerUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ success: false, message: 'Invalid conversation ID.' });
    }

    const session = await mongoose.startSession();
    let finalMessage = ''; // Message to return to the user

    try {
        await session.withTransaction(async () => {
            // 1. Fetch Conversation and associated Ride Requests
            const conversation = await Conversation.findById(conversationId).session(session);
            if (!conversation) throw { status: 404, message: 'Conversation not found.' };

            let rideA = await RideRequest.findById(conversation.rideRequestA).session(session);
            let rideB = await RideRequest.findById(conversation.rideRequestB).session(session);
            if (!rideA || !rideB) throw { status: 404, message: 'One or both associated ride requests not found.' };

            // Identify which ride belongs to the confirmer and which is the other party
            let confirmerRide, otherPartyRide;
            if (rideA.userId.equals(confirmerUserId)) {
                confirmerRide = rideA;
                otherPartyRide = rideB;
            } else if (rideB.userId.equals(confirmerUserId)) {
                confirmerRide = rideB;
                otherPartyRide = rideA;
            } else {
                throw { status: 403, message: 'You are not authorized to confirm this ride.' };
            }

            // 2. Validate Ride Statuses (must not be Confirmed already)
            if (confirmerRide.status === 'Confirmed' || otherPartyRide.status === 'Confirmed') {
                 throw { status: 409, message: 'One or both rides are already confirmed.' };
            }

            // 3. Find conversation references in both rides
            const convRefConfirmer = confirmerRide.conversations.find(c => c.conversationId.equals(conversationId));
            const convRefOtherParty = otherPartyRide.conversations.find(c => c.conversationId.equals(conversationId));

            if (!convRefConfirmer || !convRefOtherParty) {
                 throw { status: 500, message: 'Internal error: Conversation reference missing in ride document.' }; // Should not happen
            }

            // --- Mutual Confirmation Logic ---
            if (convRefConfirmer.status === 'confirmed') {
                 throw { status: 409, message: 'You have already confirmed this ride.' }; // Or just return success silently
            }

            if (convRefOtherParty.status === 'awaiting_confirmation') {
                // --- Stage 2: Mutual Confirmation Achieved ---
                convRefConfirmer.status = 'confirmed';
                convRefOtherParty.status = 'confirmed'; // Ensure both are marked

                confirmerRide.status = 'Confirmed';
                otherPartyRide.status = 'Confirmed';

                // Process and Decline Other Pending/Awaiting Conversations
                await processOtherPending(confirmerRide, conversation._id, session);
                await processOtherPending(otherPartyRide, conversation._id, session);

                finalMessage = 'Ride mutually confirmed successfully. Other pending conversations declined.';

            } else if (convRefOtherParty.status === 'pending') {
                // --- Stage 1: First Confirmation, Awaiting Other Party ---
                convRefConfirmer.status = 'awaiting_confirmation';
                // Rides remain Pending
                finalMessage = 'Confirmation recorded. Waiting for the other party to confirm.';

            } else { // Other party is 'confirmed' or 'declined'
                 throw { status: 409, message: `Cannot confirm: The other party's status for this conversation is '${convRefOtherParty.status}'.` };
            }

            // 4. Save Rides
            await confirmerRide.save({ session });
            await otherPartyRide.save({ session });

        }); // Transaction ends

        await session.endSession();
        return res.status(200).json({ success: true, message: finalMessage });

    } catch (error) {
        await session.endSession();
        console.error('Error confirming ride:', error);
        const statusCode = error.status || 500;
        const message = error.message || 'Failed to confirm ride due to a server error.';
        return res.status(statusCode).json({ success: false, message: message });
    }
};


// --- MODIFIED Controller to decline a pending/awaiting conversation ---
const declineConversation = async (req, res) => {
    const { conversationId } = req.params;
    const declinerUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ success: false, message: 'Invalid conversation ID.' });
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            // 1. Fetch Conversation and associated Ride Requests
            const conversation = await Conversation.findById(conversationId).session(session);
            if (!conversation) throw { status: 404, message: 'Conversation not found.' };

            let rideA = await RideRequest.findById(conversation.rideRequestA).session(session);
            let rideB = await RideRequest.findById(conversation.rideRequestB).session(session);
            if (!rideA || !rideB) throw { status: 404, message: 'One or both associated ride requests not found.' };

            // 2. Validate Participation
            const isParticipantA = rideA.userId.equals(declinerUserId);
            const isParticipantB = rideB.userId.equals(declinerUserId);
            if (!isParticipantA && !isParticipantB) {
                throw { status: 403, message: 'You are not authorized to decline this conversation.' };
            }

            // Prevent declining already confirmed rides via this route
            if (rideA.status === 'Confirmed' || rideB.status === 'Confirmed') {
                 throw { status: 409, message: 'Cannot decline a conversation associated with a Confirmed ride.' };
            }

            // 3. Update Conversation Status in Ride Documents to 'declined'
            const convRefA = rideA.conversations.find(c => c.conversationId.equals(conversationId));
            const convRefB = rideB.conversations.find(c => c.conversationId.equals(conversationId));

            let updated = false;
            // Allow declining from 'pending' or 'awaiting_confirmation'
            if (convRefA && ['pending', 'awaiting_confirmation'].includes(convRefA.status)) {
                convRefA.status = 'declined';
                updated = true;
            }
            if (convRefB && ['pending', 'awaiting_confirmation'].includes(convRefB.status)) {
                convRefB.status = 'declined';
                updated = true; // Mark true even if already updated by A's ref change
            }

            if (!updated) {
                 // If neither was pending/awaiting, maybe it was already declined. Silently succeed.
                 // Or throw error: throw { status: 409, message: 'Conversation was not in a pending or awaiting state.' };
                 // Let's silently succeed for idempotency.
                 console.log(`Conversation ${conversationId} already declined or in final state.`);
                 // We still need to check ride statuses below in case this is a redundant call after a confirm race condition.
            }

            // 4. Check and Update Ride Statuses if necessary
            const rideAHasOtherActive = rideA.conversations.some(c => ['pending', 'awaiting_confirmation'].includes(c.status));
            if (!rideAHasOtherActive && rideA.status === 'Pending') {
                rideA.status = 'Available';
            }

            const rideBHasOtherActive = rideB.conversations.some(c => ['pending', 'awaiting_confirmation'].includes(c.status));
            if (!rideBHasOtherActive && rideB.status === 'Pending') {
                rideB.status = 'Available';
            }

            // 5. Save Rides
            await rideA.save({ session });
            await rideB.save({ session });

        }); // Transaction ends

        await session.endSession();
        return res.status(200).json({ success: true, message: 'Conversation declined successfully.' });

    } catch (error) {
        await session.endSession();
        console.error('Error declining conversation:', error);
        const statusCode = error.status || 500;
        const message = error.message || 'Failed to decline conversation due to a server error.';
        return res.status(statusCode).json({ success: false, message: message });
    }
};


module.exports = {
    initiateConversation,
    getConversationsForCurrentRide,
    getMessagesForConversation,
    sendMessage,
    confirmRide,
    declineConversation
};
