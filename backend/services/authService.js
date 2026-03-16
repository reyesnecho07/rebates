// controllers/authController.js - FIXED VERSION
import { authenticateUser, changePassword } from '../services/userService.js';

export const login = async (req, res) => {
  try {
    const { userCode, password } = req.body;

    console.log('🔐 Login request received for user:', userCode);

    if (!userCode || !password) {
      return res.status(400).json({
        success: false,
        error: "Username and password are required"
      });
    }

    // Authenticate user using UsersDB_v1.1 ONLY
    const authResult = await authenticateUser(userCode, password);

    console.log('✅ Authentication successful');
    console.log('📊 User details:', {
      userCode: authResult.user.User_ID,
      displayName: authResult.user.DisplayName,
      oneLogPwd: authResult.user.OneLogPwd,
      isFirstLogin: authResult.isFirstLogin
    });

    return res.status(200).json({
      success: true,
      user: authResult.user,
      isFirstLogin: authResult.isFirstLogin,
      message: "Authentication successful"
    });

  } catch (error) {
    console.error('🔴 Login error:', error.message);
    return res.status(401).json({
      success: false,
      error: error.message || "Authentication failed"
    });
  }
};

export const changeUserPassword = async (req, res) => {
  try {
    const { userCode, currentPassword, newPassword } = req.body;

    console.log('🔑 Password change request for user:', userCode);

    if (!userCode || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "All fields are required"
      });
    }

    // Change password in UsersDB_v1.1
    const result = await changePassword(userCode, currentPassword, newPassword);

    console.log('✅ Password changed successfully');
    console.log('📊 Updated user:', result.user);

    return res.status(200).json({
      success: true,
      user: result.user,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error('🔴 Password change error:', error.message);
    return res.status(400).json({
      success: false,
      error: error.message || "Password change failed"
    });
  }
};