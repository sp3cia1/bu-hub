import React, { useState } from 'react';
import { Box, TextField, Button, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface MessageInputProps {
    onSend: (content: string) => void;
    isSending: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, isSending }) => {
    const [content, setContent] = useState('');

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setContent(event.target.value);
    };

    const handleSendClick = () => {
        if (content.trim() && !isSending) {
            onSend(content.trim());
            setContent(''); // Clear input after sending
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
        // Send on Enter press, allow Shift+Enter for new line
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent default form submission/new line
            handleSendClick();
        }
    };

    return (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="Type your message..."
                value={content}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                multiline // Allow multiline input
                maxRows={4} // Limit height expansion
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }} // Rounded input field
            />
            <Button
                variant="contained"
                onClick={handleSendClick}
                disabled={isSending || !content.trim()}
                sx={{ borderRadius: '50%', minWidth: '50px', height: '50px', p: 0 }} // Circular button
                aria-label="send message"
            >
                {isSending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
            </Button>
        </Box>
    );
};

export default MessageInput;
