const { RideRequest } = require('../model/index');

const MATCH_TIME_WINDOW_HOURS = 12; // +/- 12 hours window
const MAX_MATCH_RESULTS = 15; // Limit the number of returned matches

/**
 * Finds potential ride matches for a given user's ride request.
 * @param {object} userRideRequest - The Mongoose document of the user's active ride request.
 * @returns {Promise<Array<object>>} - A promise that resolves to a sorted array of potential match RideRequest documents.
 */
const findPotentialMatches = async (userRideRequest) => {
    if (!userRideRequest) {
        throw new Error('User ride request is required to find matches.');
    }

    const userDepartureTime = userRideRequest.departureTime.getTime(); // Get time in milliseconds

    // Calculate time window
    const minTime = new Date(userDepartureTime - MATCH_TIME_WINDOW_HOURS * 60 * 60 * 1000);
    const maxTime = new Date(userDepartureTime + MATCH_TIME_WINDOW_HOURS * 60 * 60 * 1000);

    try {
        // Find potential matches in the database
        const potentialMatches = await RideRequest.find({
            destination: userRideRequest.destination,
            status: 'Available', // Only match with available rides
            userId: { $ne: userRideRequest.userId }, // Exclude the user's own request
            departureTime: { $gte: minTime, $lte: maxTime } // Within the time window
        })
        // Optionally populate user details if needed later, but keep it lean for now
        // .populate('userId', 'email phoneNumber') // Example: if you need user info directly
        .lean(); // Use .lean() for performance if we don't need Mongoose documents

        if (!potentialMatches || potentialMatches.length === 0) {
            return [];
        }

        // Calculate time difference and sort
        const sortedMatches = potentialMatches
            .map(match => ({
                ...match,
                // Calculate absolute time difference in milliseconds
                timeDifference: Math.abs(match.departureTime.getTime() - userDepartureTime)
            }))
            .sort((a, b) => a.timeDifference - b.timeDifference); // Sort by ascending time difference

        // Limit the results
        return sortedMatches.slice(0, MAX_MATCH_RESULTS);

    } catch (error) {
        console.error('Error finding potential matches:', error);
        // Re-throw the error to be handled by the controller
        throw new Error('Failed to query potential matches.');
    }
};

module.exports = {
    findPotentialMatches
};
