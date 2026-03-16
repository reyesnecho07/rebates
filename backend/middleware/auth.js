// auth.js or your login route
app.post('/api/login', async (req, res) => {
  try {
    const { userCode, password } = req.body;
    
    // Your existing login logic...
    
    const query = `
      SELECT 
        USER_ID,
        UserName,
        Password,
        GroupId,
        RoleID,
        OneLogPwd,
        IsActive,
        IsSuperUser,
        DisplayName
      FROM Users 
      WHERE UserCode = ? AND IsActive = 1
    `;
    
    const [user] = await db.execute(query, [userCode]);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    // Verify password (your existing logic)
    const isValidPassword = await bcrypt.compare(password, user.Password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    // Return user data including IsSuperUser
    res.json({
      success: true,
      user: {
        userId: user.USER_ID,
        userName: user.UserName,
        displayName: user.DisplayName || user.UserName,
        groupId: user.GroupId,
        roleId: user.RoleID,
        oneLogPwd: user.OneLogPwd,
        isSuperUser: user.IsSuperUser === 1, // Convert to boolean
        isActive: user.IsActive
      },
      database: selectedDatabase, // Your existing logic
      isFirstLogin: user.OneLogPwd === 1
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});