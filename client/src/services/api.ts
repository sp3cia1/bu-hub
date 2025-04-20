import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add an interceptor to automatically include the auth token
apiClient.interceptors.request.use(
    (config) => {
        // Retrieve the token from localStorage on each request
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        // Handle request errors
        return Promise.reject(error);
    }
);

// Optional: Add an interceptor to handle common errors (like 401 Unauthorized)
// apiClient.interceptors.response.use(...)

export default apiClient;
