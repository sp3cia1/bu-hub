require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes'); 
const rideRoutes = require('./routes/rideRoutes'); 

const app = express();
const PORT = process.env.PORT || 8000; 


app.use(express.json());

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected Successfully');
  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message);
    process.exit(1);
  }
};

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);

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