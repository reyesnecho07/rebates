// backend/controllers/navigationController.js
export const getNavItemsByDatabase = async (req, res) => {
  try {
    const { databaseId } = req.params;
    const userId = req.user.UserID;
    
    console.log(`📝 Getting nav items for database ${databaseId} and user ${userId}`);
    
    const connectionDb = req.query.db || 'USER';
    
    const result = await navigationService.getNavItemsByDatabase(databaseId, userId, connectionDb);
    
    res.json({
      success: true,
      count: result.length,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error in getNavItemsByDatabase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load navigation items',
      error: error.message
    });
  }
};

// backend/routes/navigationRoutes.js
router.get('/by-database/:databaseId', auth, getNavItemsByDatabase);