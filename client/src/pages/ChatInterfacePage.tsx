import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Paper,
    IconButton,
    Avatar,
    Button,
    Snackbar,
    Tooltip,
    Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import {
    getMessages,
    sendMessage,
    Message,
    getConversations,
    FormattedConversation,
    confirmRide,
    declineConversation
} from '../services/conversationService';
import { useAuth } from '../contexts/AuthContext';
import MessageList from '../components/conversations/MessageList';
import MessageInput from '../components/conversations/MessageInput';

interface NewMessageData {
    conversationId: string;
    message: Message;
}

interface ConversationUpdateData {
    conversationId: string;
    rideAStatus?: string;
    rideBStatus?: string;
    conversationStatusA?: FormattedConversation['myStatus'];
    conversationStatusB?: FormattedConversation['myStatus'];
}

const ChatInterfacePage: React.FC = () => {
    const { conversationId } = useParams<{ conversationId: string }>();
    const navigate = useNavigate();
    const { user, socket } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversationDetails, setConversationDetails] = useState<FormattedConversation | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isSending, setIsSending] = useState<boolean>(false);
    const [isConfirming, setIsConfirming] = useState<boolean>(false);
    const [isDeclining, setIsDeclining] = useState<boolean>(false);
    const [actionFeedback, setActionFeedback] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        const fetchChatData = async () => {
            if (!conversationId) {
                setError('Conversation ID is missing.');
                setIsLoading(false);
                return;
            }
            console.log(`[ChatInterfacePage] Fetching data for conversation: ${conversationId}`); // Log start
            setIsLoading(true);
            setError(null);
            setConversationDetails(null);
            setMessages([]);

            try {
                const [fetchedMessages, allConversations] = await Promise.all([
                    getMessages(conversationId),
                    getConversations()
                ]);

                // --- DEBUG LOG: Log fetched conversations ---
                console.log('[ChatInterfacePage] Fetched all conversations:', JSON.stringify(allConversations, null, 2));
                // --- END DEBUG LOG ---

                setMessages(fetchedMessages);

                const currentConv = allConversations.find(conv => conv.conversationId === conversationId);

                // --- DEBUG LOG: Log found conversation ---
                console.log(`[ChatInterfacePage] Found current conversation details (ID: ${conversationId}):`, currentConv ? JSON.stringify(currentConv, null, 2) : 'NOT FOUND');
                // --- END DEBUG LOG ---

                if (currentConv) {
                    setConversationDetails(currentConv);
                } else {
                    console.warn(`Details for conversation ${conversationId} not found in user's list AFTER fetch.`);
                    setError(prev => prev ? `${prev}\nCould not load conversation details.` : 'Could not load conversation details.');
                }

            } catch (err: any) {
                console.error("Failed to fetch chat data:", err);
                setError(err.message || 'Failed to load chat data.');
                setMessages([]);
                setConversationDetails(null);
            } finally {
                setIsLoading(false);
                console.log(`[ChatInterfacePage] Finished fetching data for conversation: ${conversationId}`); // Log end
            }
        };

        fetchChatData();
    }, [conversationId]);

    useEffect(() => {
        if (!socket || !conversationId) {
            console.log("Socket or conversationId missing, not attaching listener.");
            return;
        }

        console.log(`Attaching 'newMessage' listener for conversation: ${conversationId}`);

        const handleNewMessage = (data: NewMessageData) => {
            console.log("Received 'newMessage' event:", data);
            if (data.conversationId === conversationId) {
                setMessages((prevMessages) => {
                    const exists = prevMessages.some(
                        msg => msg.senderId === data.message.senderId &&
                               msg.timestamp === data.message.timestamp &&
                               msg.content === data.message.content
                    );
                    if (!exists) {
                        console.log("Adding new message to state:", data.message);
                        return [...prevMessages, data.message];
                    }
                    console.log("Duplicate message detected, not adding.");
                    return prevMessages;
                });
            } else {
                console.log(`Message received for different conversation (${data.conversationId}), ignoring.`);
            }
        };

        socket.on('newMessage', handleNewMessage);

        return () => {
            console.log(`Detaching 'newMessage' listener for conversation: ${conversationId}`);
            socket.off('newMessage', handleNewMessage);
        };

    }, [socket, conversationId]);

    useEffect(() => {
        if (!socket || !conversationId || !user?._id) {
            console.log("Socket, conversationId, or user ID missing, not attaching 'conversationUpdate' listener.");
            return;
        }

        console.log(`Attaching 'conversationUpdate' listener for conversation: ${conversationId}`);

        const handleConversationUpdate = (data: ConversationUpdateData) => {
            console.log("Received 'conversationUpdate' event:", data);
            if (data.conversationId === conversationId) {
                console.log("[ChatInterfacePage] Conversation status updated via WebSocket, refetching details...");
                // --- DEBUG LOG: Log state before refetch ---
                console.log('[ChatInterfacePage] State BEFORE WebSocket triggered refetch:', { conversationDetails });
                // --- END DEBUG LOG ---
                getConversations().then(allConversations => {
                    // --- DEBUG LOG: Log refetched conversations ---
                    console.log('[ChatInterfacePage] Refetched all conversations after WS update:', JSON.stringify(allConversations, null, 2));
                    // --- END DEBUG LOG ---
                    const updatedConv = allConversations.find(conv => conv.conversationId === conversationId);
                     // --- DEBUG LOG: Log found conversation after refetch ---
                    console.log(`[ChatInterfacePage] Found current conversation details AFTER WS refetch (ID: ${conversationId}):`, updatedConv ? JSON.stringify(updatedConv, null, 2) : 'NOT FOUND');
                    // --- END DEBUG LOG ---
                    if (updatedConv) {
                        setConversationDetails(updatedConv);
                    } else {
                        console.warn(`Refetched details for updated conversation ${conversationId} not found.`);
                        setError('Conversation details lost after update.');
                    }
                }).catch(err => {
                    console.error("Error refetching conversation details after update:", err);
                    setError('Failed to refresh conversation status.');
                });
            }
        };

        socket.on('conversationUpdate', handleConversationUpdate);

        return () => {
            console.log(`Detaching 'conversationUpdate' listener for conversation: ${conversationId}`);
            socket.off('conversationUpdate', handleConversationUpdate);
        };
    }, [socket, conversationId, user?._id]);

    const handleSendMessage = async (content: string) => {
        if (!content || !conversationId || isSending) return;

        setIsSending(true);
        setError(null);
        try {
            const response = await sendMessage(conversationId, content);
            if (response.success && response.sentMessage) {
                // WebSocket will handle adding the message to the list
            } else {
                setError(response.message || 'Failed to send message.');
            }
        } catch (err: any) {
            console.error("Failed to send message:", err);
            setError(err.message || 'An unexpected error occurred while sending.');
        } finally {
            setIsSending(false);
        }
    };

    const handleConfirm = async () => {
        if (!conversationId || isConfirming || isDeclining) return;
        setIsConfirming(true);
        setActionFeedback({ open: false, message: '', severity: 'success' });
        try {
            const response = await confirmRide(conversationId);
            setActionFeedback({ open: true, message: response.message, severity: 'success' });
        } catch (err: any) {
            console.error("Failed to confirm ride:", err);
            setActionFeedback({ open: true, message: err.message || 'Failed to confirm ride.', severity: 'error' });
        } finally {
            setIsConfirming(false);
        }
    };

    const handleDecline = async () => {
        if (!conversationId || isConfirming || isDeclining) return;
        setIsDeclining(true);
        setActionFeedback({ open: false, message: '', severity: 'success' });
        try {
            const response = await declineConversation(conversationId);
            setActionFeedback({ open: true, message: response.message, severity: 'success' });
        } catch (err: any) {
            console.error("Failed to decline conversation:", err);
            setActionFeedback({ open: true, message: err.message || 'Failed to decline conversation.', severity: 'error' });
        } finally {
            setIsDeclining(false);
        }
    };

    const handleCloseFeedback = () => {
        setActionFeedback({ ...actionFeedback, open: false });
    };

    const handleGoBack = () => {
        navigate('/chats');
    };

    const currentUserId = user?._id || '';
    const otherUser = conversationDetails?.otherUser;
    const myStatus = conversationDetails?.myStatus;
    const allowMessaging = myStatus === 'pending' || myStatus === 'awaiting_confirmation' || myStatus === 'confirmed';
    const isDeclined = myStatus === 'declined';
    const canConfirm = myStatus === 'pending' || myStatus === 'awaiting_confirmation';
    const canDecline = myStatus === 'pending' || myStatus === 'awaiting_confirmation';

    return (
        <Paper
            elevation={2}
            sx={{
                mt: 2,
                mx: 'auto',
                maxWidth: 'md',
                height: 'calc(100vh - 64px - 32px - 16px)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                <IconButton onClick={handleGoBack} sx={{ mr: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
                {otherUser && (
                     <Avatar
                         alt={otherUser.displayName || otherUser.email}
                         src={otherUser.avatarUrl}
                         sx={{ width: 32, height: 32, mr: 1.5 }}
                     >
                         {otherUser.displayName ? otherUser.displayName.charAt(0).toUpperCase() : otherUser.email.charAt(0).toUpperCase()}
                     </Avatar>
                )}
                <Typography variant="h6" component="h1" noWrap sx={{ flexGrow: 1 }}>
                    {isLoading ? 'Loading...' : otherUser?.displayName || otherUser?.email || 'Chat'}
                </Typography>
                {!isLoading && conversationDetails && (
                    <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
                        {canConfirm && (
                            <Tooltip title={myStatus === 'awaiting_confirmation' ? "You are awaiting confirmation" : "Confirm Ride Share"}>
                                <span>
                                    <Button
                                        variant="contained"
                                        color="success"
                                        size="small"
                                        startIcon={isConfirming ? <CircularProgress size={20} color="inherit" /> : <CheckCircleOutlineIcon />}
                                        onClick={handleConfirm}
                                        disabled={isConfirming || isDeclining || myStatus === 'awaiting_confirmation'}
                                    >
                                        {myStatus === 'awaiting_confirmation' ? 'Awaiting' : 'Confirm'}
                                    </Button>
                                </span>
                            </Tooltip>
                        )}
                        {canDecline && (
                             <Tooltip title="Decline Ride Share">
                                <span>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        size="small"
                                        startIcon={isDeclining ? <CircularProgress size={20} color="inherit" /> : <CancelIcon />}
                                        onClick={handleDecline}
                                        disabled={isConfirming || isDeclining}
                                    >
                                        Decline
                                    </Button>
                                </span>
                            </Tooltip>
                        )}
                        {myStatus === 'confirmed' && <Chip label="Confirmed" color="success" size="small" variant="outlined" sx={{ alignSelf: 'center' }} />}
                        {myStatus === 'declined' && <Chip label="Declined" color="error" size="small" variant="outlined" sx={{ alignSelf: 'center' }} />}
                    </Box>
                )}
            </Box>

            {isLoading ? (
                <Box flexGrow={1} display="flex" justifyContent="center" alignItems="center">
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Box flexGrow={1} p={2}>
                    <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{error}</Alert>
                </Box>
            ) : (
                <>
                    <MessageList messages={messages} currentUserId={currentUserId} />
                    {allowMessaging && (
                        <MessageInput onSend={handleSendMessage} isSending={isSending} />
                    )}
                    {isDeclined && (
                        <Alert severity="info" sx={{ m: 1.5, borderTop: 1, borderColor: 'divider' }}>
                            This conversation was declined. Messaging is disabled.
                        </Alert>
                    )}
                </>
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
        </Paper>
    );
};

export default ChatInterfacePage;
