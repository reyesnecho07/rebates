// backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      console.log('❌ No authorization header provided');
      return res.status(401).json({
        success: false,
        message: 'No authorization header, access denied'
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token || token === 'undefined' || token === 'null') {
      console.log('❌ Token is missing or invalid string:', token);
      return res.status(401).json({
        success: false,
        message: 'No valid authentication token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Normalize req.user so ALL controllers can safely use req.user.UserID
    req.user = {
      ...decoded,
      // UserID: always resolves regardless of which field name was used in jwt.sign
      UserID: decoded.UserID || decoded.User_ID || decoded.userId || decoded.user_id || decoded.id || null,
      Username: decoded.Username || decoded.username || decoded.UserName || null,
      IsSuperUser: decoded.IsSuperUser === true || decoded.IsSuperUser === 1 || false,
    };

    console.log('✅ Auth OK — UserID:', req.user.UserID, '| IsSuperUser:', req.user.IsSuperUser);
    next();

  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired, please log in again' });
    }

    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

export const isSuperUser = (req, res, next) => {
  if (req.user?.IsSuperUser) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Super user privileges required.'
    });
  }
};