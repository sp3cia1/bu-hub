import React, { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    CircularProgress,
    Alert,
    Chip,
    Divider
} from '@mui/material';
import { RideRequest, deleteRideRequest } from '../../services/rideService';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

interface RideDisplayProps {
    ride: RideRequest;
    onDeleteSuccess: () => void; // Callback when deletion is successful
}

const RideDisplay: React.FC<RideDisplayProps> = ({ ride, onDeleteSuccess }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDelete = async () => {
        // Optional: Add a confirmation dialog here
        // if (!window.confirm("Are you sure you want to cancel this ride request?")) {
        //     return;
        // }

        setIsDeleting(true);
        setDeleteError(null);
        try {
            const response = await deleteRideRequest();
            if (response.success) {
                onDeleteSuccess(); // Notify parent component
            } else {
                setDeleteError(response.message || 'Failed to cancel ride request.');
            }
        } catch (err: any) {
            console.error("Failed to delete ride request:", err);
            setDeleteError(err.response?.data?.message || err.message || 'An error occurred while cancelling.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Format departure time for display
    const formattedDepartureTime = new Date(ride.departureTime).toLocaleString([], {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });

    return (
        <Card
            sx={{
                maxWidth: 'md', // Limit width
                mx: 'auto', // Center the card
                mb: 4, // Margin bottom
                backgroundColor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                boxShadow: 5,
            }}
        >
            <CardContent sx={{ pb: 1 }}> {/* Reduced bottom padding */}
                <Typography variant="h5" component="div" gutterBottom color="primary.main">
                    Your Active Ride Request
                </Typography>

                {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}

                <Box display="flex" alignItems="center" mb={1.5}>
                    <LocationOnIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.primary">
                        Destination: <strong>{ride.destination}</strong>
                    </Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={2}>
                    <AccessTimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.primary">
                        Departure: <strong>{formattedDepartureTime}</strong>
                    </Typography>
                </Box>
                 <Box display="flex" alignItems="center">
                     <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>Status:</Typography>
                     <Chip label={ride.status} color={ride.status === 'Available' ? 'success' : ride.status === 'Pending' ? 'warning' : 'primary'} size="small" />
                 </Box>

            </CardContent>
            <Divider />
            <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                <Button
                    variant="outlined"
                    color="error"
                    startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteForeverIcon />}
                    onClick={handleDelete}
                    disabled={isDeleting}
                >
                    Cancel Ride Request
                </Button>
            </CardActions>
        </Card>
    );
};

export default RideDisplay;
