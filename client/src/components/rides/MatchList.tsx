import React, { useState } from 'react';
import {
    List,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Typography,
    Button,
    Box,
    Divider,
    Chip,
    CircularProgress,
    Snackbar,
    Alert
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BlockIcon from '@mui/icons-material/Block';
import { RideRequest } from '../../services/rideService';
import { initiateConversation } from '../../services/conversationService';
import { useNavigate } from 'react-router-dom';

interface ConversationRef {
    rideId: string;
    status: 'pending' | 'awaiting_confirmation' | 'confirmed' | 'declined';
    conversationId: string;
}

interface MatchListProps {
    matches: RideRequest[];
    onInitiateSuccess: () => void;
    currentRideConversations: ConversationRef[];
}

const MatchList: React.FC<MatchListProps> = ({ matches, onInitiateSuccess, currentRideConversations }) => {
    const [initiatingConvId, setInitiatingConvId] = useState<string | null>(null);
    const [errorSnackbar, setErrorSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
    const navigate = useNavigate();

    const handleStartConversation = async (match: RideRequest) => {
        setInitiatingConvId(match._id);
        setErrorSnackbar({ open: false, message: '' });

        try {
            const response = await initiateConversation(match._id);
            console.log('Conversation initiated:', response);

            if (response.success && response.conversation) {
                onInitiateSuccess();
            } else {
                setErrorSnackbar({ open: true, message: response.message || 'Could not start conversation.' });
            }
        } catch (err: any) {
            console.error("Failed to initiate conversation:", err);
            setErrorSnackbar({ open: true, message: err.message || 'An unexpected error occurred.' });
        } finally {
            setInitiatingConvId(null);
        }
    };

    const handleViewConversation = (conversationId: string) => {
        console.log('Navigating to existing chat:', conversationId);
        navigate(`/chat/${conversationId}`);
    };

    const handleCloseSnackbar = () => {
        setErrorSnackbar({ open: false, message: '' });
    };

    return (
        <>
            <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: '8px', border: 1, borderColor: 'divider' }}>
                {matches.map((match, index) => {
                    const isLoading = initiatingConvId === match._id;

                    const conversationRef = currentRideConversations.find(
                        conv => conv.rideId === match._id
                    );
                    const isActiveConv = conversationRef && conversationRef.status !== 'declined';
                    const isDeclinedConv = conversationRef && conversationRef.status === 'declined';

                    return (
                        <React.Fragment key={match._id}>
                            <ListItem
                                alignItems="flex-start"
                                secondaryAction={
                                    isActiveConv ? (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<VisibilityIcon />}
                                            onClick={() => handleViewConversation(conversationRef.conversationId)}
                                        >
                                            View Chat
                                        </Button>
                                    ) : isDeclinedConv ? (
                                        <Chip
                                            icon={<BlockIcon />}
                                            label="Declined"
                                            size="small"
                                            color="error"
                                            variant="outlined"
                                            disabled
                                        />
                                    ) : (
                                        <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <ChatIcon />}
                                            onClick={() => handleStartConversation(match)}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? 'Starting...' : 'Chat'}
                                        </Button>
                                    )
                                }
                                sx={{ py: 2 }}
                            >
                                <ListItemAvatar>
                                    <Avatar alt={match.userId?.displayName} src={match.userId?.avatarUrl}>
                                        {match.userId?.displayName ? match.userId.displayName.charAt(0).toUpperCase() : '?'}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography variant="body1" component="span" fontWeight="medium">
                                            {match.userId?.displayName || 'Unknown User'}
                                        </Typography>
                                    }
                                    secondary={
                                        <>
                                            <Typography
                                                sx={{ display: 'block' }}
                                                component="span"
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Departs: {new Date(match.departureTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </Typography>
                                        </>
                                    }
                                />
                            </ListItem>
                            {index < matches.length - 1 && <Divider variant="inset" component="li" />}
                        </React.Fragment>
                    );
                })}
            </List>

            <Snackbar
                open={errorSnackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
                    {errorSnackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default MatchList;
