import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { RideRequest, getCurrentRideRequest, getMatchesForCurrentRide } from '../services/rideService';
import CreateRideForm from '../components/rides/CreateRideForm';
import RideDisplay from '../components/rides/RideDisplay';
import MatchList from '../components/rides/MatchList';

const HomePage: React.FC = () => {
    const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [matches, setMatches] = useState<RideRequest[]>([]);
    const [matchesLoading, setMatchesLoading] = useState<boolean>(false);
    const [matchesError, setMatchesError] = useState<string | null>(null);

    const fetchRideData = async () => {
        setIsLoading(true);
        setError(null);
        setMatches([]);
        setMatchesError(null);
        try {
            const response = await getCurrentRideRequest();
            if (response.success) {
                setCurrentRide(response.rideRequest);
            } else {
                setError('Failed to retrieve ride status.');
                setCurrentRide(null);
            }
        } catch (err: any) {
            console.error("Failed to fetch current ride request:", err);
            setError(err.response?.data?.message || err.message || 'Failed to load ride status.');
            setCurrentRide(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRideData();
    }, []);

    useEffect(() => {
        const fetchMatches = async () => {
            if (!currentRide) {
                setMatches([]);
                return;
            }

            setMatchesLoading(true);
            setMatchesError(null);
            try {
                const fetchedMatches = await getMatchesForCurrentRide();
                setMatches(fetchedMatches);
            } catch (err: any) {
                console.error("Failed to fetch matches:", err);
                setMatchesError(err.response?.data?.message || err.message || 'Failed to load potential matches.');
                setMatches([]);
            } finally {
                setMatchesLoading(false);
            }
        };

        fetchMatches();
    }, [currentRide]);

    const handleRideCreated = (newRide: RideRequest) => {
        console.log("Ride created successfully, refetching data...", newRide);
        fetchRideData();
        setError(null);
    };

    const handleRideDeleted = () => {
        setCurrentRide(null);
        setError(null);
        console.log("Ride deleted successfully, showing create form.");
    };

    const handleInitiateSuccess = () => {
        console.log("Conversation initiated, refetching ride data...");
        fetchRideData();
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error && !currentRide) {
        return (
            <Alert severity="error" sx={{ mt: 4 }}>
                {error}
            </Alert>
        );
    }

    return (
        <Box sx={{ mt: 4 }}>
            {currentRide ? (
                <>
                    <RideDisplay ride={currentRide} onDeleteSuccess={handleRideDeleted} />

                    <Box sx={{ mt: 4, maxWidth: 'md', mx: 'auto' }}>
                        <Typography variant="h6" gutterBottom>Potential Matches</Typography>
                        {matchesLoading && (
                            <Box display="flex" justifyContent="center" sx={{ my: 2 }}>
                                <CircularProgress size={30} />
                            </Box>
                        )}
                        {matchesError && (
                            <Alert severity="warning" sx={{ my: 2 }}>{matchesError}</Alert>
                        )}
                        {!matchesLoading && !matchesError && (
                            matches.length > 0 ? (
                                <MatchList
                                    matches={matches}
                                    onInitiateSuccess={handleInitiateSuccess}
                                    currentRideConversations={currentRide.conversations || []}
                                />
                            ) : (
                                <Typography color="text.secondary">No matches found yet. We'll keep looking!</Typography>
                            )
                        )}
                    </Box>
                </>
            ) : (
                <CreateRideForm onSuccess={handleRideCreated} />
            )}
        </Box>
    );
};

export default HomePage;
