import apiClient from './api';

// Interface for the request body
interface InitiateConversationRequest {
    targetRideId: string;
}

// Interface for the successful response body (based on backend controller)
// Assuming 'Conversation' type is defined elsewhere or we define relevant parts here
interface Conversation {
    _id: string;
    rideRequestA: string;
    rideRequestB: string;
    messages: any[]; // Define message type later if needed
    expiresAt: string;
    // Add other fields if returned and needed
}

interface InitiateConversationResponse {
    success: boolean;
    message: string;
    conversation?: Conversation; // The created or existing conversation
    initiatorRideStatus?: string;
    targetRideStatus?: string;
}

// --- NEW: Interface for the formatted conversation list from GET /api/conversations ---
export interface FormattedConversation {
    conversationId: string;
    otherRideId: string;
    otherUser: {
        _id: string;
        email: string; // Or displayName/avatarUrl if backend changes
        // phoneNumber?: string; // Consider privacy
        displayName?: string; // Add if backend populates this
        avatarUrl?: string;   // Add if backend populates this
    };
    otherRideDetails: {
        destination: string;
        departureTime: string;
    };
    myStatus: 'pending' | 'awaiting_confirmation' | 'confirmed' | 'declined';
    otherPartyStatus: 'pending' | 'awaiting_confirmation' | 'confirmed' | 'declined' | 'unknown';
    lastMessage?: { // Optional last message
        senderId: string;
        content: string;
        timestamp: string;
    };
    initiatedAt?: string; // Optional
    expiresAt?: string;
}

interface GetConversationsResponse {
    success: boolean;
    conversations: FormattedConversation[];
}
// --- END NEW ---

// --- NEW: Interface for a single message ---
export interface Message {
    senderId: string;
    content: string;
    timestamp: string;
    _id?: string; // Optional _id if included by backend (often subdocs don't have it by default)
}

// --- NEW: Interface for Get Messages API Response ---
interface GetMessagesResponse {
    success: boolean;
    messages: Message[];
}

// --- NEW: Interface for Send Message API Request ---
interface SendMessageRequest {
    content: string;
}

// --- NEW: Interface for Send Message API Response ---
interface SendMessageResponse {
    success: boolean;
    message: string;
    sentMessage: Message;
}
// --- END NEW ---

// --- NEW: Interface for Confirm/Decline API Response ---
interface ActionResponse {
    success: boolean;
    message: string;
}
// --- END NEW ---

/**
 * Initiates a conversation with the owner of the target ride request.
 * @param targetRideId - The ID of the RideRequest to start a conversation with.
 * @returns Promise resolving to the API response.
 */
export const initiateConversation = async (targetRideId: string): Promise<InitiateConversationResponse> => {
    try {
        const requestBody: InitiateConversationRequest = { targetRideId };
        const response = await apiClient.post<InitiateConversationResponse>('/conversations', requestBody);
        return response.data;
    } catch (error: any) {
        console.error('Initiate Conversation API error:', error.response?.data || error.message);
        // Re-throw the error structure from the backend if available
        if (error.response?.data) {
            throw error.response.data;
        }
        // Throw a generic error if no specific backend error is available
        throw { success: false, message: error.message || 'Failed to initiate conversation due to a network or server error.' };
    }
};

/**
 * Fetches the list of formatted conversations associated with the user's current ride request.
 * @returns Promise resolving to an array of FormattedConversation objects.
 */
export const getConversations = async (): Promise<FormattedConversation[]> => {
    try {
        const response = await apiClient.get<GetConversationsResponse>('/conversations');
        // Return the conversations array, or an empty array if response is not successful or data is missing
        return response.data?.conversations || [];
    } catch (error: any) {
        console.error('Get Conversations API error:', error.response?.data || error.message);
        // Return empty array on error to prevent breaking UI expecting an array
        return [];
        // Or re-throw if the calling component should handle the error state explicitly
        // throw error;
    }
};

// --- NEW: Function to get messages for a specific conversation ---
/**
 * Fetches messages for a given conversation ID.
 * @param conversationId - The ID of the conversation.
 * @returns Promise resolving to an array of Message objects.
 */
export const getMessages = async (conversationId: string): Promise<Message[]> => {
    if (!conversationId) return []; // Avoid request if ID is missing

    try {
        const response = await apiClient.get<GetMessagesResponse>(`/conversations/${conversationId}/messages`);
        return response.data?.messages || [];
    } catch (error: any) {
        console.error(`Get Messages API error (Conv ID: ${conversationId}):`, error.response?.data || error.message);
        // Return empty array on error
        return [];
        // Or re-throw if the component handles errors
        // throw error;
    }
};
// --- END NEW ---

// --- NEW: Function to send a message in a conversation ---
/**
 * Sends a message to a specific conversation.
 * @param conversationId - The ID of the conversation.
 * @param content - The text content of the message.
 * @returns Promise resolving to the API response containing the sent message.
 */
export const sendMessage = async (conversationId: string, content: string): Promise<SendMessageResponse> => {
    if (!conversationId || !content) {
        throw { success: false, message: 'Conversation ID and message content are required.' };
    }

    try {
        const requestBody: SendMessageRequest = { content };
        const response = await apiClient.post<SendMessageResponse>(`/conversations/${conversationId}/messages`, requestBody);
        return response.data;
    } catch (error: any) {
        console.error(`Send Message API error (Conv ID: ${conversationId}):`, error.response?.data || error.message);
        // Re-throw structured error from backend if available
        if (error.response?.data) {
            throw error.response.data;
        }
        throw { success: false, message: error.message || 'Failed to send message due to a network or server error.' };
    }
};
// --- END NEW ---

// --- NEW: Function to confirm a ride share arrangement ---
/**
 * Confirms the ride share for a given conversation.
 * @param conversationId - The ID of the conversation to confirm.
 * @returns Promise resolving to the API response.
 */
export const confirmRide = async (conversationId: string): Promise<ActionResponse> => {
    if (!conversationId) {
        throw { success: false, message: 'Conversation ID is required.' };
    }
    try {
        const response = await apiClient.post<ActionResponse>(`/conversations/${conversationId}/confirm`);
        return response.data;
    } catch (error: any) {
        console.error(`Confirm Ride API error (Conv ID: ${conversationId}):`, error.response?.data || error.message);
        if (error.response?.data) {
            throw error.response.data;
        }
        throw { success: false, message: error.message || 'Failed to confirm ride due to a network or server error.' };
    }
};
// --- END NEW ---

// --- NEW: Function to decline a conversation ---
/**
 * Declines a pending/awaiting conversation.
 * @param conversationId - The ID of the conversation to decline.
 * @returns Promise resolving to the API response.
 */
export const declineConversation = async (conversationId: string): Promise<ActionResponse> => {
    if (!conversationId) {
        throw { success: false, message: 'Conversation ID is required.' };
    }
    try {
        const response = await apiClient.post<ActionResponse>(`/conversations/${conversationId}/decline`);
        return response.data;
    } catch (error: any) {
        console.error(`Decline Conversation API error (Conv ID: ${conversationId}):`, error.response?.data || error.message);
        if (error.response?.data) {
            throw error.response.data;
        }
        throw { success: false, message: error.message || 'Failed to decline conversation due to a network or server error.' };
    }
};
// --- END NEW ---

// Add other conversation-related service functions here later (get messages, send message, etc.)
