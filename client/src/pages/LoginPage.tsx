import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Link, 
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { loginUser } from '../services/authService'; 

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth(); 
    const navigate = useNavigate();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null); 

        // basic validation
        if (!email || !phoneNumber) {
            setError('Please enter both email and phone number.');
            return;
        }
        // More specific email validation can be added here if needed

        setLoading(true);
        try {
            const response = await loginUser({ email, phoneNumber });

            if (response.success && response.accessToken && response.user) {
                // call context login function on successful API response
                login(response.accessToken, response.user);
                navigate('/'); // redirect to home page on success
            } else {
                setError(response.message || 'Login failed. Please check your credentials.');
            }
        } catch (err) {
            // Catch errors not handled by authService (e.g., network errors)
            setError('An unexpected error occurred. Please try again.');
            console.error("Login Page Error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs"> {/* xs for smaller login box */}
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 3,
                    borderRadius: '12px', 
                    backgroundColor: 'background.paper', 
                    boxShadow: 20, 
                    border: 1, 
                    borderColor: 'divider' 
                }}
            >
                <Typography
                    component="h1"
                    variant="h4" 
                    fontWeight="bold"
                    color="primary" 
                    gutterBottom
                    sx={{ mb: 3 }} 
                >
                    Get Started
                </Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
                    {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="College Email"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        placeholder="user@bennett.edu.in" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        sx={{ mb: 1.5 }} 
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="phoneNumber"
                        label="Phone Number"
                        type="tel" // tel type for phone numbers
                        id="phoneNumber"
                        autoComplete="tel"
                        placeholder="Your phone number" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={loading}
                        sx={{ mb: 3 }}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        disabled={loading}
                        sx={{
                            py: 1.5, 
                            fontWeight: 'bold',
                            borderRadius: '8px', 
                            // Apply gradient background (Note: Direct gradient in sx is tricky, might need styled-components or ::before pseudo-element later for perfect match)
                            // Using primary color for now, gradient requires more setup
                            // background: `linear-gradient(to right, ${theme.palette.primary.main}, ${theme.palette.info.main})`, // Example gradient attempt
                            // color: 'common.black', // Text color for gradient button
                            '&:hover': {
                                // Define hover style if needed, gradients might need specific hover setup
                            },
                            position: 'relative', // Needed for potential CircularProgress overlay
                        }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Login / Register'}
                    </Button>
                    <Typography variant="caption" display="block" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
                        Fast & secure login via Bennett email.
                    </Typography>
                    {/* Optional: Add Link to Register Page if separate */}
                    {/* <Box textAlign="center" sx={{ mt: 2 }}>
                        <Link component={RouterLink} to="/register" variant="body2">
                            Don't have an account? Register
                        </Link>
                    </Box> */}
                </Box>
            </Box>
        </Container>
    );
};

export default LoginPage;
