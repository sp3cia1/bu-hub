import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Message } from '../../services/conversationService';

interface MessageListProps {
    messages: Message[];
    currentUserId: string;
}

const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId }) => {
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]); // Scroll whenever messages change

    return (
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, bgcolor: 'action.hover', display: 'flex', flexDirection: 'column' }}>
            {messages.map((msg, index) => {
                const isCurrentUser = msg.senderId === currentUserId;
                return (
                    <Box
                        key={msg._id || `${msg.senderId}-${msg.timestamp}-${index}`} // Use index as fallback key if _id isn't present
                        sx={{
                            display: 'flex',
                            justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                            mb: 1,
                        }}
                    >
                        <Paper
                            elevation={1}
                            sx={{
                                p: 1.5, // Increased padding
                                maxWidth: '70%',
                                bgcolor: isCurrentUser ? 'primary.main' : 'background.paper',
                                color: isCurrentUser ? 'primary.contrastText' : 'text.primary',
                                borderRadius: isCurrentUser ? '15px 15px 5px 15px' : '15px 15px 15px 5px', // Chat bubble shape
                                wordBreak: 'break-word', // Ensure long words wrap
                            }}
                        >
                            <Typography variant="body1">
                                {msg.content}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    textAlign: 'right',
                                    mt: 0.5,
                                    fontSize: '0.65rem', // Smaller timestamp
                                    opacity: 0.7, // Less prominent timestamp
                                }}
                            >
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </Typography>
                        </Paper>
                    </Box>
                );
            })}
            {/* Dummy element to scroll to */}
            <div ref={messagesEndRef} />
        </Box>
    );
};

export default MessageList;
