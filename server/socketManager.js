let io = null;

// Call this function once in index.js after initializing io
const initializeSocketIO = (ioInstance) => {
    if (!io) {
        io = ioInstance;
        console.log('Socket.IO initialized');
    }
    return io;
};

// Function to get the io instance
const getIoInstance = () => {
    if (!io) {
        // This should ideally not happen if initialized correctly at startup
        console.error('Socket.IO has not been initialized.');
        // Depending on strictness, you might throw an error or return null
        // throw new Error('Socket.IO has not been initialized.');
        return null;
    }
    return io;
};

// Helper function to emit events to a specific conversation room
const emitToConversation = (conversationId, eventName, data) => {
    const ioInstance = getIoInstance();
    if (ioInstance && conversationId) {
        // console.log(`Emitting ${eventName} to room ${conversationId.toString()}`);
        ioInstance.to(conversationId.toString()).emit(eventName, data);
    } else if (!ioInstance) {
         console.error(`Socket.IO instance not available for emitting ${eventName}`);
    } else {
         console.warn(`Attempted to emit ${eventName} without a valid conversationId`);
    }
};

// Helper function to emit events directly to a user (if we track sockets by userId)
// For now, we'll primarily use room-based emission.
// const emitToUser = (userId, eventName, data) => { ... }

module.exports = {
    initializeSocketIO,
    getIoInstance,
    emitToConversation,
};
