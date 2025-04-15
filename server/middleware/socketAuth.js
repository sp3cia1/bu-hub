const { User } = require('../model/index');

const socketAuthenticate = async (socket, next) => {
    // Extract token from handshake data (client should send it)
    const token = socket.handshake.auth?.token;

    if (!token) {
        console.error('Socket Auth Error: No token provided');
        return next(new Error('Authentication error: No token provided.'));
    }

    try {
        // Find user by accessToken
        const user = await User.findOne({ accessToken: token }).select('+accessToken'); // Ensure token is selected if needed later

        if (!user) {
            console.error(`Socket Auth Error: Invalid token - ${token.substring(0, 5)}...`);
            return next(new Error('Authentication error: Invalid token.'));
        }

        // Attach user to the socket object for use in event handlers
        socket.user = user;
        // console.log(`Socket Authenticated: User ${user.email} (${socket.id})`);
        next(); // Proceed to connection

    } catch (error) {
        console.error('Socket Auth Error:', error);
        return next(new Error('Authentication error: Server error.'));
    }
};

module.exports = {
    socketAuthenticate
};
