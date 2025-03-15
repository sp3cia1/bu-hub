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