const { User } = require('../model/index');

const extractTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    // removes 'Bearer ' prefix (first 7 characters)
    return authHeader.substring(7);
};

//middleware to authenticate then retreive user object
const authenticate = async (req, res, next) => {
    try {
      // extract token from header
      const token = extractTokenFromHeader(req);
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. No token provided.'
        });
      }
      
      // find user
      const user = await User.findOne({ accessToken: token });
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token.'
        });
      }
      
      // attach user to request object for use in downstream controllers
      req.user = user;
    
      next();
        
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication failed due to server error.'
      });
    }
  };
