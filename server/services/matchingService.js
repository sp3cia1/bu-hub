const { RideRequest } = require('../model/index');

// Configuration: Time window for matching (e.g., +/- 60 minutes)
const MATCH_TIME_WINDOW_MINUTES = 60;

/**
 * Finds potential ride matches for a given ride request.
 * @param {object} userRideRequest - The Mongoose document for the user's ride request.
 * @returns {Promise<Array<string>>} - A promise that resolves to an array of potential match RideRequest IDs.
 */
const findPotentialMatches = async (userRideRequest) => {
    if (!userRideRequest) {
        throw new Error("User ride request is required for matching.");
    }

    // --- DEBUG LOG: Log Input ---
    console.log('[MatchingService] Input Ride Request:', {
        _id: userRideRequest._id,
        userId: userRideRequest.userId,
        destination: userRideRequest.destination,
        departureTime: userRideRequest.departureTime,
        status: userRideRequest.status,
        conversations: userRideRequest.conversations // Log existing conversations
    });
    // --- END DEBUG LOG ---

    const userDepartureTime = userRideRequest.departureTime.getTime();
    const timeWindowMillis = MATCH_TIME_WINDOW_MINUTES * 60 * 1000;

    // Calculate the time window for matching
    const minDeparture = new Date(userDepartureTime - timeWindowMillis);
    const maxDeparture = new Date(userDepartureTime + timeWindowMillis);

    console.log('[MatchingService] Time Window:', {
        minDeparture: minDeparture.toISOString(),
        maxDeparture: maxDeparture.toISOString()
    });

    
    const excludedRideIds = [userRideRequest._id];

    // Iterate through the user's conversations and add rides that are CONFIRMED *by this user*.
    // Declined rides will no longer be excluded from matching results.
    userRideRequest.conversations.forEach(conv => {
        // --- MODIFIED: Only exclude confirmed ---
        if (conv.status === 'confirmed') {
        // --- END MODIFIED ---
            if (conv.rideId) { // Ensure rideId exists
                if (!excludedRideIds.find(id => id.equals(conv.rideId))) {
                    excludedRideIds.push(conv.rideId);
                    console.log(`[MatchingService] Adding rideId ${conv.rideId.toString()} to exclusion list due to status: ${conv.status}`);
                }
            } else {
                console.warn(`[MatchingService] Conversation reference missing rideId for convId: ${conv.conversationId?.toString()}`);
            }
        }
    });

    

    // Define the criteria for finding matches
    const matchCriteria = {
        _id: { $nin: excludedRideIds }, // Exclude self and rides from user's confirmed conversations
        userId: { $ne: userRideRequest.userId }, // Ensure it's not the user's own request
        destination: userRideRequest.destination, // Must match destination
        status: { $in: ['Available', 'Pending'] }, // Match must be Available OR Pending
        departureTime: {
            $gte: minDeparture,
            $lte: maxDeparture,
        },
    };

    // --- DEBUG LOG: Log Query Criteria ---
    console.log('[MatchingService] MongoDB Query Criteria:', JSON.stringify(matchCriteria, null, 2));
    // --- END DEBUG LOG ---

    try {
        // Find potential matches based on criteria, selecting only the ID
        const results = await RideRequest.find(matchCriteria).select('_id userId departureTime status destination').lean(); // Select more fields for debugging

        // --- DEBUG LOG: Log Raw Results ---
        console.log('[MatchingService] Raw DB Results:', results);
        // --- END DEBUG LOG ---

        // Return only the IDs
        return results.map(match => match._id);

    } catch (error) {
        console.error("[MatchingService] Error finding potential matches:", error);
        throw new Error("Database error during match finding."); // Propagate a generic error
    }
};

module.exports = {
    findPotentialMatches,
};
