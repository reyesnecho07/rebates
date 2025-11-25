import { authenticateUser, simpleAuthenticate, formatUserName } from '../services/authService.js';

export const login = async (req, res) => {
  try {
    console.log("Login endpoint called!");
    console.log("Request body:", req.body);
    
    const { username, password, database } = req.body;

    const user = await authenticateUser(username, password, database);
    const fullName = formatUserName(user.U_NAME);

    console.log(`✅ User logged in: ${user.USER_CODE} from ${database}`);
    res.json({ 
      success: true, 
      message: "Login successful", 
      userID: user.USER_CODE,
      username: fullName,
      database: database
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(401).json({ 
      success: false, 
      message: err.message 
    });
  }
};

export const simpleLogin = async (req, res) => {
  try {
    const { userCode, database } = req.body;

    const user = await simpleAuthenticate(userCode, database);
    const fullName = formatUserName(user.U_NAME);

    console.log(`✅ Simple login successful: ${user.USER_CODE} from ${database}`);
    res.json({ 
      success: true, 
      message: "Login successful", 
      userID: user.USER_CODE,
      username: fullName,
      database: database
    });
  } catch (err) {
    console.error("Error during simple login:", err);
    res.status(401).json({ 
      success: false, 
      message: err.message 
    });
  }
};