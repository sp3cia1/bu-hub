import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client'; // Import socket.io-client

// Define the shape of the user object
interface User {
    _id: string;
    email: string;
    phoneNumber: string;
    displayName: string;
    avatarUrl: string;
}

// Define the shape of the authentication state
interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    socket: Socket | null; // Add socket instance to state
}

// Define the shape of the context value
interface AuthContextType extends Omit<AuthState, 'socket'> { // Exclude socket setter logic from public type
    socket: Socket | null; // Allow reading the socket instance
    login: (token: string, user: User) => void;
    logout: () => void;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define props for the provider component
interface AuthProviderProps {
    children: ReactNode;
}

// Backend URL for WebSocket connection
const SOCKET_SERVER_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create the provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [authState, setAuthState] = useState<AuthState>({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: true,
        socket: null, // Initialize socket as null
    });

    // Effect to check local storage on initial mount
    useEffect(() => {
        const storedToken = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('user'); // Assuming user data is also stored

        if (storedToken && storedUser) {
            try {
                const userObj: User = JSON.parse(storedUser);
                if (userObj && userObj.displayName && userObj.avatarUrl) {
                    setAuthState({
                        token: storedToken,
                        user: userObj,
                        isAuthenticated: true,
                        isLoading: false,
                        socket: null,
                    });
                    console.log("Auth state restored from localStorage");
                } else {
                    throw new Error("Stored user data is missing required fields.");
                }
            } catch (error) {
                console.error("Failed to parse or validate stored user data:", error);
                localStorage.removeItem('accessToken'); // Clear invalid data
                localStorage.removeItem('user');
                setAuthState(prev => ({ ...prev, isLoading: false, token: null, user: null, isAuthenticated: false, socket: null }));
            }
        } else {
            setAuthState(prev => ({ ...prev, isLoading: false })); // No token found, stop loading
        }
    }, []);

    // Effect to manage WebSocket connection based on token presence
    useEffect(() => {
        // Only attempt connection if loading is finished and we have a token
        if (!authState.isLoading && authState.token) {
            console.log("Attempting WebSocket connection...");
            // Connect to the server with the token for authentication
            const newSocket = io(SOCKET_SERVER_URL, {
                auth: {
                    token: authState.token,
                },
            });

            // Set up listeners
            newSocket.on('connect', () => {
                console.log('WebSocket Connected:', newSocket.id);
                setAuthState(prev => ({ ...prev, socket: newSocket })); // Store socket instance on successful connection
            });

            newSocket.on('disconnect', (reason) => {
                console.log('WebSocket Disconnected:', reason);
                setAuthState(prev => ({ ...prev, socket: null })); // Clear socket instance on disconnect
            });

            newSocket.on('connect_error', (error) => {
                console.error('WebSocket Connection Error:', error.message);
            });

            // --- Add listeners for application-specific events ---
            newSocket.on('newMessage', (data) => {
                console.log('Received newMessage event:', data);
            });

            newSocket.on('conversationUpdate', (data) => {
                console.log('Received conversationUpdate event:', data);
            });
            // --- End application-specific listeners ---

            // Cleanup function: Disconnect socket when token changes or component unmounts
            return () => {
                console.log("Cleaning up WebSocket connection...");
                newSocket.disconnect();
                setAuthState(prev => ({ ...prev, socket: null })); // Ensure socket state is cleared on cleanup
            };
        } else if (!authState.isLoading && !authState.token && authState.socket) {
            // If loading is done, no token, but socket somehow still exists, disconnect it
            console.log("Disconnecting socket due to missing token.");
            authState.socket.disconnect();
            setAuthState(prev => ({ ...prev, socket: null }));
        }

        // No cleanup needed if no token or still loading
        return () => {};

    }, [authState.token, authState.isLoading]); // Re-run effect if token or loading state changes

    // Login function: Updates state and stores token/user
    const login = (token: string, user: User) => {
        console.log("AuthContext: login called");
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        setAuthState(prev => ({
            ...prev,
            token: token,
            user: user,
            isAuthenticated: true,
            isLoading: false,
        }));
    };

    // Logout function: Clears state and storage
    const logout = () => {
        console.log("AuthContext: logout called");
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setAuthState({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            socket: null,
        });
    };

    // Value provided by the context
    const value: AuthContextType = {
        token: authState.token,
        user: authState.user,
        isAuthenticated: authState.isAuthenticated,
        isLoading: authState.isLoading,
        socket: authState.socket,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Create the consumer hook
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
