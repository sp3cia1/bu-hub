import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    Avatar,
    IconButton,
    Menu,
    MenuItem,
    Tooltip,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
    const { isAuthenticated, user, logout, isLoading } = useAuth();
    const navigate = useNavigate();
    const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

    const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const handleLogout = () => {
        handleCloseUserMenu();
        logout();
        navigate('/login'); // Redirect to login after logout
    };

    // Don't render navbar content until auth state is loaded
    if (isLoading) {
        return null; // Or a minimal loading bar if preferred
    }

    return (
        <AppBar
            position="static"
            elevation={0} // Flat design, rely on border
            sx={{
                // Use theme colors
                backgroundColor: 'background.paper', // d-card
                borderBottom: 1,
                borderColor: 'divider', // d-border
                // Gradient attempt (might need refinement or styled-components)
                // background: `linear-gradient(to right, ${theme.palette.background.paper}, #1f2937 50%, ${theme.palette.background.paper})`,
            }}
        >
            <Toolbar>
                {/* App Title/Logo */}
                <Typography
                    variant="h6"
                    noWrap
                    component={RouterLink}
                    to="/"
                    sx={{
                        mr: 2,
                        flexGrow: 1, // Pushes user menu to the right
                        fontWeight: 700,
                        color: 'primary.main', // d-primary
                        textDecoration: 'none',
                    }}
                >
                    BU Hub
                </Typography>

                {/* Conditional Rendering based on Auth State */}
                {isAuthenticated && user ? (
                    <Box sx={{ flexGrow: 0 }}>
                        <Tooltip title="Open settings">
                            <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                                <Avatar
                                    alt={user.displayName || user.email}
                                    src={user.avatarUrl}
                                    sx={{ width: 40, height: 40 }}
                                >
                                    {/* Fallback Initials if src fails */}
                                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                                </Avatar>
                            </IconButton>
                        </Tooltip>
                        <Menu
                            sx={{ mt: '45px' }}
                            id="menu-appbar"
                            anchorEl={anchorElUser}
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            keepMounted
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            open={Boolean(anchorElUser)}
                            onClose={handleCloseUserMenu}
                        >
                            <MenuItem disabled>
                                <Typography textAlign="center" fontWeight="medium">{user.displayName}</Typography>
                            </MenuItem>
                            {/* Add other menu items like 'Profile', 'Settings' later */}
                            <MenuItem onClick={handleLogout}>
                                <Typography textAlign="center">Logout</Typography>
                            </MenuItem>
                        </Menu>
                    </Box>
                ) : (
                    // Show Login button if not authenticated
                    <Button
                        color="inherit"
                        component={RouterLink}
                        to="/login"
                        sx={{ color: 'text.primary' }} // Use theme text color
                    >
                        Login
                    </Button>
                )}
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;
