import React from 'react';
import {
    List,
    ListItemButton, // Use ListItemButton for click effect
    ListItemAvatar,
    Avatar,
    ListItemText,
    Typography,
    Divider,
    Box, // For layout
    Button, // For actions
    Chip, // For status
    CircularProgress, // For loading
    Tooltip // For hints
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';
import { FormattedConversation } from '../../services/conversationService';
import { formatDistanceToNowStrict } from 'date-fns'; // For relative time

// Helper function to format timestamp
const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return '';
    try {
        return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true });
    } catch (e) {
        console.error("Error formatting date:", e);
        return 'Invalid date';
    }
};

interface ConversationListProps {
    conversations: FormattedConversation[];
    // --- Add action props ---
    onConfirm: (conversationId: string) => void;
    onDecline: (conversationId: string) => void;
    confirmingId: string | null;
    decliningId: string | null;
    // --- End action props ---
}

const ConversationList: React.FC<ConversationListProps> = ({
    conversations,
    onConfirm,
    onDecline,
    confirmingId,
    decliningId
}) => {
    const navigate = useNavigate();

    const handleConversationClick = (conversationId: string) => {
        navigate(`/chat/${conversationId}`);
    };

    return (
        <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: '8px', border: 1, borderColor: 'divider' }}>
            {conversations.map((conv, index) => {
                const otherUser = conv.otherUser;
                const lastMsg = conv.lastMessage;
                const myStatus = conv.myStatus;
                const isConfirming = confirmingId === conv.conversationId;
                const isDeclining = decliningId === conv.conversationId;
                const canConfirm = myStatus === 'pending' || myStatus === 'awaiting_confirmation';
                const canDecline = myStatus === 'pending' || myStatus === 'awaiting_confirmation';

                return (
                    <React.Fragment key={conv.conversationId}>
                        <ListItemButton
                            alignItems="flex-start"
                            onClick={() => handleConversationClick(conv.conversationId)}
                            sx={{ py: 1.5 }} // Adjust padding
                        >
                            <ListItemAvatar sx={{ mt: 0.5 }}> {/* Align avatar better */}
                                <Avatar alt={otherUser?.displayName || otherUser?.email} src={otherUser?.avatarUrl}>
                                    {otherUser?.displayName ? otherUser.displayName.charAt(0).toUpperCase() : otherUser?.email?.charAt(0).toUpperCase() || '?'}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Typography variant="body1" component="span" fontWeight="medium" noWrap>
                                        {otherUser?.displayName || otherUser?.email || 'Unknown User'}
                                    </Typography>
                                }
                                secondary={
                                    <>
                                        <Typography
                                            sx={{ display: 'block' }}
                                            component="span"
                                            variant="body2"
                                            color="text.secondary"
                                            noWrap // Prevent long messages from breaking layout
                                        >
                                            {lastMsg ? `${lastMsg.senderId === otherUser?._id ? '' : 'You: '}${lastMsg.content}` : 'No messages yet'}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ display: 'block', mt: 0.5 }}
                                        >
                                            {formatTimestamp(lastMsg?.timestamp)}
                                        </Typography>
                                    </>
                                }
                                sx={{ mr: 1 }} // Margin right to avoid overlap with actions
                            />
                            {/* --- Action Buttons/Status Area --- */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, ml: 'auto', flexShrink: 0 }}>
                                {canConfirm && (
                                    <Tooltip title={myStatus === 'awaiting_confirmation' ? "You are awaiting confirmation" : "Confirm Ride Share"}>
                                        <span>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                size="small"
                                                startIcon={isConfirming ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineIcon fontSize="small" />}
                                                onClick={(e) => { e.stopPropagation(); onConfirm(conv.conversationId); }} // Stop propagation to prevent navigation
                                                disabled={isConfirming || isDeclining || myStatus === 'awaiting_confirmation'}
                                                sx={{ minWidth: '80px' }} // Ensure consistent width
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
                                                startIcon={isDeclining ? <CircularProgress size={16} color="inherit" /> : <CancelIcon fontSize="small" />}
                                                onClick={(e) => { e.stopPropagation(); onDecline(conv.conversationId); }} // Stop propagation
                                                disabled={isConfirming || isDeclining}
                                                sx={{ minWidth: '80px' }} // Ensure consistent width
                                            >
                                                Decline
                                            </Button>
                                        </span>
                                    </Tooltip>
                                )}
                                {myStatus === 'confirmed' && <Chip label="Confirmed" color="success" size="small" variant="outlined" />}
                                {myStatus === 'declined' && <Chip label="Declined" color="error" size="small" variant="outlined" />}
                            </Box>
                            {/* --- End Action Buttons/Status Area --- */}
                        </ListItemButton>
                        {index < conversations.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                );
            })}
        </List>
    );
};

export default ConversationList;
