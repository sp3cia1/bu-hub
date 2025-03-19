const { User } = require('../model/index');
const crypto = require('crypto');

// User registration
const handleRegisteration = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;
    
    if (!email || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and phone number are required' 
      });
    }
    
    if (!email.endsWith('.bennett.edu.in')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please use a valid Bennett University email' 
      });
    }
    
    // check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }
    
    // generate token
    const accessToken = crypto.randomBytes(20).toString('hex');
    
    // create user
    const newUser = new User({
      email,
      phoneNumber,
      isEmailVerified: true, // since this is just the mvp we arent verifying
      accessToken
    });
    
    await newUser.save();
    
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      accessToken,
      user: {
        email: newUser.email,
        phoneNumber: newUser.phoneNumber
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Registration failed' 
    });
  }
};

module.exports = {
    handleRegisteration
};