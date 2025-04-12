const { User } = require('../model/index');
const crypto = require('crypto');

// User registration
const handleRegistration = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;
    
    if (!email || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and phone number are required' 
      });
    }
    
    if (!email.endsWith('@bennett.edu.in')) {
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

const handleLogin = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;
    
    if (!email || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and phone number are required' 
      });
    }
    
    if (!email.endsWith('@bennett.edu.in')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please use a valid Bennett University email' 
      });
    }
    
    if (!/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number must be 10 digits' 
      });
    }
    
    // find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found. Please register first' 
      });
    }
    
    if (user.phoneNumber !== phoneNumber) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    let accessToken = user.accessToken;
    
    // generate new token if none exists
    if (!accessToken) {
      accessToken = crypto.randomBytes(20).toString('hex');
      user.accessToken = accessToken;
      await user.save();
    }
    
    // return success response
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      user: {
        email: user.email,
        phoneNumber: user.phoneNumber
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Login failed due to server error' 
    });
  }
};

module.exports = {
    handleRegistration,
    handleLogin
};