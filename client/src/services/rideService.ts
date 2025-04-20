import apiClient from './api';

// --- TypeScript Interfaces (Align with Backend Models) ---

// Based on server/model/index.js RideRequest schema
export interface RideRequest {
    _id: string;
    userId: string; // Or populate with User object if backend does
    destination: 'Airport' | 'Train Station' | 'Bus Terminal';
    departureTime: string; // ISO Date string
    status: 'Available' | 'Pending' | 'Confirmed';
    conversations: {
        conversationId: string;
        rideId: string; // Counterpart's RideRequest ID
        status: 'pending' | 'awaiting_confirmation' | 'confirmed' | 'declined';
    }[];
    createdAt: string;
    updatedAt: string;
    // Add user details if populated by backend
    user?: {
        _id: string; // Include ID if populated
        displayName: string;
        avatarUrl: string;
    }
}

// Interface for creating a new ride request
export interface CreateRideData {
    destination: 'Airport' | 'Train Station' | 'Bus Terminal';
    departureTime: string; // ISO Date string
}

// Interface for the response when getting matches
// Assuming backend returns an array of RideRequest objects for matches, potentially populated with user details
export type MatchesResponse = RideRequest[];

// Interface for a generic success response (e.g., for deletion)
export interface SuccessResponse {
    success: boolean;
    message: string;
}

// --- NEW: Define specific response type for getCurrentRideRequest ---
export interface GetCurrentRideResponse {
    success: boolean;
    rideRequest: RideRequest | null; // The actual ride data or null
}
// --- END NEW ---

// --- FIX: Define specific response type for getMatchesForCurrentRide ---
export interface GetMatchesApiResponse {
    success: boolean;
    message: string;
    matches: RideRequest[]; // The array of matches is nested
}
// --- END FIX ---

// --- Service Functions ---

/**
 * Fetches the current user's active ride request.
 * @returns Promise resolving to an object containing success status and the RideRequest or null.
 */
// --- FIX: Update return type and ensure correct data structure is returned ---
export const getCurrentRideRequest = async (): Promise<GetCurrentRideResponse> => {
    try {
        // Backend returns { success: boolean, rideRequest: RideRequest | null }
        const response = await apiClient.get<GetCurrentRideResponse>('/rides/current');
        // Return the entire response object as received from backend
        return response.data;
    } catch (error: any) {
        console.error('Get Current Ride Request API error:', error.response?.data || error.message);
        // Re-throw or return a default error structure if needed
        // Example: return { success: false, rideRequest: null }; (Depends on how you want to handle errors)
        throw error; // Re-throw for component-level handling is often preferred
    }
};
// --- END FIX ---

/**
 * Creates a new ride request for the current user.
 * @param data - Destination and departure time.
 * @returns Promise resolving to the newly created RideRequest.
 */
export const createRideRequest = async (data: CreateRideData): Promise<RideRequest> => {
    try {
        const response = await apiClient.post<RideRequest>('/rides', data);
        return response.data;
    } catch (error: any) {
        console.error('Create Ride Request API error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Deletes the current user's active ride request.
 * @returns Promise resolving to a success message object.
 */
export const deleteRideRequest = async (): Promise<SuccessResponse> => {
    try {
        const response = await apiClient.delete<SuccessResponse>('/rides/current');
        return response.data;
    } catch (error: any) {
        console.error('Delete Ride Request API error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches potential matches for the current user's ride request.
 * @returns Promise resolving to an array of matching RideRequests.
 */
// --- FIX: Update return type and extract matches array ---
export const getMatchesForCurrentRide = async (): Promise<RideRequest[]> => {
    try {
        // Backend returns { success: boolean, message: string, matches: RideRequest[] }
        const response = await apiClient.get<GetMatchesApiResponse>('/rides/current/matches');
        // Return only the matches array, or an empty array if it doesn't exist
        return response.data?.matches || [];
    } catch (error: any) {
        console.error('Get Matches API error:', error.response?.data || error.message);
        // Return empty array on error to prevent breaking UI expecting an array
        return [];
        // Or re-throw if HomePage should handle the error state explicitly
        // throw error;
    }
};
// --- END FIX ---
