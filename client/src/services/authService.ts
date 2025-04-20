import apiClient from './api';

interface LoginCredentials {
    email: string;
    phoneNumber: string;
}

interface LoginResponse {
    success: boolean;
    message: string;
    accessToken?: string;
    user?: {
        _id: string;
        email: string;
        phoneNumber: string;
        displayName: string;
        avatarUrl: string;
    };
}

/**
 * Calls the backend login endpoint.
 * @param credentials - User's email and phone number.
 * @returns Promise resolving to the LoginResponse data.
 */
export const loginUser = async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
        const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
        return response.data;
    } catch (error: any) {
        // Handle and re-throw or return a structured error
        console.error('Login API error:', error.response?.data || error.message);
        // Return the error structure from the backend if available
        if (error.response?.data) {
            return error.response.data as LoginResponse; // Assuming error response matches success structure
        }
        // Fallback error
        return {
            success: false,
            message: error.message || 'An unknown error occurred during login.',
        };
    }
};

/**
 * Calls the backend register endpoint.
 * (Implementation similar to loginUser, adjust types and endpoint)
 */
// export const registerUser = async (credentials: RegisterCredentials): Promise<RegisterResponse> => { ... }

// Add other auth-related API functions (e.g., verify, logout if needed)
