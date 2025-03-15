const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  requestCount: { 
    count: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  },
  currentRideRequest: {
    type: Schema.Types.ObjectId,
    ref: 'RideRequest',
    default: null
  }
});

// RideRequest Schema
const RideRequestSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  destination: {
    type: String,
    required: true,
    enum: ['Airport', 'Train Station', 'Bus Terminal'] // Customize these destinations
  },
  departureTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Available', 'Pending', 'Confirmed'],
    default: 'Available'
  },
  // Multiple matches support
  matches: [{
    rideId: {
      type: Schema.Types.ObjectId, 
      ref: 'RideRequest'
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'declined'],
      default: 'pending'
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    initiatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method to reset the daily request count before calling increment request count
UserSchema.methods.resetDailyCountIfNeeded = function() {
  const now = new Date();
  const lastReset = new Date(this.requestCount.lastReset);
  
  // Reset if last reset was not today
  if (now.getDate() !== lastReset.getDate() || 
      now.getMonth() !== lastReset.getMonth() || 
      now.getFullYear() !== lastReset.getFullYear()) {
    
    this.requestCount.count = 0;
    this.requestCount.lastReset = now;
    return true;
  }
  return false;
};

// Method to increment request count
UserSchema.methods.incrementRequestCount = function() {
  this.resetDailyCountIfNeeded();
  this.requestCount.count += 1;
  return this.requestCount.count;
};

const User = mongoose.model('User', UserSchema);

module.exports = {
  User
};