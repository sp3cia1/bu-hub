require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors'); 
const { initializeSocketIO } = require('./socketManager');
const { socketAuthenticate } = require('./middleware/socketAuth');
const { User, RideRequest } = require('./model');

const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const conversationRoutes = require('./routes/conversationRoutes');

const app = express();
const httpServer = http.createServer(app);

// --- Define Allowed Origins ---
const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:3000", // Default frontend
    "http://localhost:5500", // Common Live Server port
    "http://127.0.0.1:5500"  // Another common Live Server address
    // Add other origins if needed
];

// --- CORS Configuration for Express ---
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests, or file://)
        // Note: Allowing null origin might be needed for file:// but consider security implications.
        // For stricter control, remove `!origin` check if only specific origins are needed.
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error(`Not allowed by CORS from origin: ${origin}`));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Allow common methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
    credentials: true // If you need to handle cookies or authorization headers
};

// --- Initialize Socket.IO (using similar origin logic) ---
const io = new Server(httpServer, {
    cors: corsOptions // Use the same CORS options for Socket.IO
});
initializeSocketIO(io);

const PORT = process.env.PORT || 8000;

// --- Express Middleware ---
app.use(cors(corsOptions)); // Apply CORS middleware to all Express routes
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));

// --- Rate Limiting Configuration ---
const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per windowMs
	standardHeaders: 'draft-7', // Recommended standard headers
	legacyHeaders: false, // Disable legacy headers
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

const authLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	limit: 10, // Limit each IP to 10 auth attempts (register/login) per hour
	standardHeaders: 'draft-7',
	legacyHeaders: false,
    message: 'Too many authentication attempts from this IP, please try again after an hour',
    // Skip successful requests? Could be considered, but simple limit is often fine.
    // skipSuccessfulRequests: true,
});

// Apply limiters to specific routes
app.use('/api/auth', authLimiter); // Stricter limit for authentication
app.use('/api/rides', generalLimiter); // General limit for ride operations
app.use('/api/conversations', generalLimiter); // General limit for conversation operations

// --- Socket.IO Middleware ---
io.use(socketAuthenticate); // Apply authentication middleware to each connection

// --- Socket.IO Connection Handling ---
io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.email} (${socket.id})`);

    // Join rooms based on active conversations
    try {
        const userRide = await RideRequest.findById(socket.user.currentRideRequest)
                                          .select('conversations') 
                                          .lean(); 

        if (userRide && userRide.conversations) {
            userRide.conversations.forEach(convRef => {
                if (convRef.conversationId) {
                    // console.log(`User ${socket.user.email} joining room ${convRef.conversationId.toString()}`);
                    socket.join(convRef.conversationId.toString());
                }
            });
        }
    } catch (error) {
        console.error(`Error fetching ride/conversations for socket room joining (User: ${socket.user.email}):`, error);
    }


    // Handle disconnect
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.user.email} (${socket.id}), Reason: ${reason}`);
        // Potential cleanup if needed
    });

    // Example: Listen for client-side events if necessary
    // socket.on('clientEvent', (data) => { ... });
});

// --- Database Connection ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected Successfully');
  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message);
    process.exit(1);
  }
};

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/conversations', conversationRoutes);

// --- Start Server ---
const startServer = async () => {
  await connectDB(); 

  app.get('/', (req, res) => { 
    res.send('BU Hub Server is Running!');
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

  httpServer.listen(PORT, () => {
    console.log(`Server Started on Port ${PORT}`);
  });
};

startServer(); // Initialize the server start process