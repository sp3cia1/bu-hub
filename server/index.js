require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const conversationRoutes = require('./routes/conversationRoutes');

const app = express();
const PORT = process.env.PORT || 8000;

// --- Middleware ---
app.use(express.json()); 

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

  app.listen(PORT, () => {
    console.log(`Server Started on Port ${PORT}`);
  });
};

startServer(); // Initialize the server start process