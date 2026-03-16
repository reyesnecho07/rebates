// controllers/authController.js
import { authenticateUser, changePassword } from '../services/userService.js';
import jwt from 'jsonwebtoken';

// ✅ Fail fast at startup if JWT_SECRET is missing
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
}

// ============================================================================
// LOGIN
// ============================================================================
export const login = async (req, res) => {
  try {
    const { userCode, password } = req.body;

    if (!userCode || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const authResult = await authenticateUser(userCode, password);

    const token = jwt.sign(
      {
        UserID: authResult.user.UserID || authResult.user.User_ID,
        Username: authResult.user.Username,
        IsSuperUser: authResult.user.IsSuperUser || false,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        ...authResult.user,
        OneLogPwd: authResult.user.OneLogPwd
      },
      isFirstLogin: authResult.isFirstLogin,
      OneLogPwd: authResult.user.OneLogPwd,
      requirePasswordChange: authResult.isFirstLogin || authResult.user.OneLogPwd === 1,
      message: 'Authentication successful'
    });

  } catch (error) {
    console.error('🔴 Login error:', error.message);
    return res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed'
    });
  }
};

// ============================================================================
// CHANGE PASSWORD
// ✅ IMPORTANT: This route MUST be protected by the auth middleware in
//    databaseRoutes.js (or authRoutes.js). req.user is set by authMiddleware.
//
//    Route should be:  router.put('/change-password', auth, changeUserPassword)
// ============================================================================
export const changeUserPassword = async (req, res) => {
  try {
    const { userCode, currentPassword, newPassword } = req.body;

    if (!userCode || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'userCode, currentPassword, and newPassword are required'
      });
    }

    // ✅ Prevent users from changing someone else's password.
    //    req.user is populated by authMiddleware — compare against the
    //    token-verified username so the body cannot be spoofed.
    const tokenUsername = req.user?.Username;
    if (tokenUsername && tokenUsername.toLowerCase() !== userCode.toLowerCase()) {
      console.warn(
        `⚠️ Password change blocked: token owner "${tokenUsername}" tried to change password for "${userCode}"`
      );
      return res.status(403).json({
        success: false,
        error: 'You can only change your own password'
      });
    }

    const result = await changePassword(userCode, currentPassword, newPassword);

    // Issue a fresh token after a successful password change
    const token = jwt.sign(
      {
        UserID: result.user.UserID || result.user.User_ID,
        Username: result.user.Username,
        IsSuperUser: result.user.IsSuperUser || false,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: result.user,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('🔴 Password change error:', error.message);
    return res.status(400).json({
      success: false,
      error: error.message || 'Password change failed'
    });
  }
};