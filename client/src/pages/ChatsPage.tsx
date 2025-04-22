import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress, Alert, Snackbar, Container } from '@mui/material';
import ConversationList from '../components/conversations/ConversationList';
import { getConversations, FormattedConversation, confirmRide, declineConversation } from '../services/conversationService';
import { useAuth } from '../contexts/AuthContext';

const ChatsPage: React.FC = () => {
    const [conversations, setConversations] = useState<FormattedConversation[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const { socket } = useAuth();

    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [decliningId, setDecliningId] = useState<string | null>(null);
    const [actionFeedback, setActionFeedback] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });

    const fetchConversations = useCallback(async () => {
        setError(null);
        try {
            const fetchedConversations = await getConversations();
            setConversations(fetchedConversations);
        } catch (err: any) {
            console.error("Failed to fetch conversations:", err);
            setError(err.message || 'Failed to load conversations.');
            setConversations([]);
        } finally {
            if (isLoading) setIsLoading(false);
        }
    }, [isLoading]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    useEffect(() => {
        if (!socket) return;

        const handleConversationUpdate = (data: any) => {
            console.log("ChatsPage received 'conversationUpdate':", data);
            fetchConversations();
        };

        socket.on('conversationUpdate', handleConversationUpdate);
        console.log("ChatsPage attached 'conversationUpdate' listener.");

        return () => {
            socket.off('conversationUpdate', handleConversationUpdate);
            console.log("ChatsPage detached 'conversationUpdate' listener.");
        };
    }, [socket, fetchConversations]);

    const handleConfirm = async (conversationId: string) => {
        if (confirmingId || decliningId) return;
        setConfirmingId(conversationId);
        setActionFeedback({ open: false, message: '', severity: 'success' });
        try {
            const response = await confirmRide(conversationId);
            setActionFeedback({ open: true, message: response.message, severity: 'success' });
        } catch (err: any) {
            setActionFeedback({ open: true, message: err.message || 'Failed to confirm.', severity: 'error' });
        } finally {
            setConfirmingId(null);
        }
    };

    const handleDecline = async (conversationId: string) => {
        if (confirmingId || decliningId) return;
        setDecliningId(conversationId);
        setActionFeedback({ open: false, message: '', severity: 'success' });
        try {
            const response = await declineConversation(conversationId);
            setActionFeedback({ open: true, message: response.message, severity: 'success' });
        } catch (err: any) {
            setActionFeedback({ open: true, message: err.message || 'Failed to decline.', severity: 'error' });
        } finally {
            setDecliningId(null);
        }
    };

    const handleCloseFeedback = () => {
        setActionFeedback({ ...actionFeedback, open: false });
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary', fontWeight: 'medium' }}>
                Your Conversations
            </Typography>

            {isLoading && (
                <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {error && (
                <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>
            )}

            {!isLoading && !error && (
                conversations.length > 0 ? (
                    <ConversationList
                        conversations={conversations}
                        onConfirm={handleConfirm}
                        onDecline={handleDecline}
                        confirmingId={confirmingId}
                        decliningId={decliningId}
                    />
                ) : (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                        You have no active conversations associated with your current ride request.
                    </Typography>
                )
            )}

            <Snackbar
                open={actionFeedback.open}
                autoHideDuration={6000}
                onClose={handleCloseFeedback}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseFeedback} severity={actionFeedback.severity} sx={{ width: '100%' }}>
                    {actionFeedback.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default ChatsPage;
