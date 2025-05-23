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
  displayName: {
    type: String,
    // required: true // Generated on creation
    // unique: true // Consider adding if strict uniqueness is needed + handle collisions
  },
  avatarUrl: {
    type: String,
    // required: true // Generated on creation
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
  },
  accessToken: {
    type: String,
    default: null
  }
}, { timestamps: true });

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
    enum: ['Airport', 'Train Station', 'Bus Terminal'] //in mvp pick from limited option
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
  conversations: [{ 
    rideId: {
      type: Schema.Types.ObjectId,
      ref: 'RideRequest',
      required: true 
    },
    status: {
      type: String,
      enum: ['pending', 'awaiting_confirmation', 'confirmed', 'declined'],
      default: 'pending'
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true 
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

// for efficient lookup from middleware (O(logn)) without O(n)
UserSchema.index({ accessToken: 1 });

// TTL index for auto-cleanup
RideRequestSchema.index({ departureTime: 1 }, { expireAfterSeconds: 0 });
// Index for efficient matching queries
RideRequestSchema.index({ destination: 1, status: 1, departureTime: 1 }); // Compound index for matching

const ConversationSchema = new Schema({
  rideRequestA: {
    type: Schema.Types.ObjectId,
    ref: 'RideRequest',
    required: true
  },
  rideRequestB: {
    type: Schema.Types.ObjectId,
    ref: 'RideRequest',
    required: true
  },
  
  messages: [{
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500 
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
    // we will set in controller based on ride departure + buffer time
  }
})

// TTL index for auto-cleanup
ConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

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

// Pre-save hook to enforce message limit
ConversationSchema.pre('save', function(next) {
  // Check if messages array exceeds our limit
  if (this.messages && this.messages.length > 20) {
    console.log(`Trimming conversation ${this._id} messages from ${this.messages.length} to 20`);
    
    // Keep only the 20 most recent messages
    this.messages = this.messages.slice(-20);
  }
  next();
});

const User = mongoose.model('User', UserSchema);
const RideRequest = mongoose.model('RideRequest', RideRequestSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);

module.exports = {
  User,
  RideRequest,
  Conversation
};