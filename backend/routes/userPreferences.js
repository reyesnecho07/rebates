import express from 'express';
import sql from 'mssql';
import { dbConfigs } from '../config/database.js';

const router = express.Router();

// Helper function to get UserID (integer) from User_ID or Username
const getActualUserId = async (pool, userIdentifier) => {
    try {
        console.log(`Looking for user with identifier: ${userIdentifier}`);
        
        // First try to find by User_ID (string)
        let result = await pool.request()
            .input('userIdentifier', sql.NVarChar(50), userIdentifier)
            .query(`
                SELECT UserID, User_ID, Username 
                FROM Users 
                WHERE User_ID = @userIdentifier
            `);
        
        // If not found by User_ID, try by Username
        if (result.recordset.length === 0) {
            console.log(`Not found by User_ID, trying Username...`);
            result = await pool.request()
                .input('userIdentifier', sql.NVarChar(50), userIdentifier)
                .query(`
                    SELECT UserID, User_ID, Username 
                    FROM Users 
                    WHERE Username = @userIdentifier
                `);
        }
        
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            console.log(`Found user: UserID=${user.UserID}, User_ID=${user.User_ID}, Username=${user.Username}`);
            return {
                userId: user.UserID,  // This is the integer UserID (1, 2, 3, etc.)
                userCode: user.User_ID, // This is the string User_ID (USR001, TEC)5, etc.)
                username: user.Username
            };
        }
        
        console.log(`User not found with identifier: ${userIdentifier}`);
        return null;
    } catch (error) {
        console.error('Error getting actual UserID:', error);
        return null;
    }
};

// Get user's theme preference
router.get('/preferences/:userId/theme', async (req, res) => {
    let pool;
    try {
        const { userId } = req.params;
        const { db } = req.query;
        
        console.log(`GET theme request: userId=${userId}, db=${db}`);
        
        if (!db) {
            return res.status(400).json({
                success: false,
                message: 'Database parameter (db) is required'
            });
        }
        
        // Get database config based on query parameter
        const dbConfig = dbConfigs[db];
        if (!dbConfig) {
            return res.status(400).json({
                success: false,
                message: `Invalid database: ${db}`
            });
        }
        
        pool = await sql.connect(dbConfig);
        
        // Get the actual UserID from the Users table
        const userInfo = await getActualUserId(pool, userId);
        
        if (!userInfo) {
            return res.json({
                success: true,
                value: null,
                message: 'User not found'
            });
        }
        
        console.log(`Querying preferences for UserID: ${userInfo.userId}`);
        
        const result = await pool.request()
            .input('userId', sql.Int, userInfo.userId)  // Use Int type for UserID
            .query(`
                SELECT PreferenceValue 
                FROM UserPreferences 
                WHERE UserID = @userId AND PreferenceKey = 'theme'
            `);
        
        if (result.recordset.length > 0) {
            res.json({
                success: true,
                value: result.recordset[0].PreferenceValue,
                actualUserId: userInfo.userId,
                userCode: userInfo.userCode,
                username: userInfo.username
            });
        } else {
            res.json({
                success: true,
                value: null,
                actualUserId: userInfo.userId,
                userCode: userInfo.userCode,
                username: userInfo.username
            });
        }
    } catch (error) {
        console.error('Error fetching theme:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching theme preference'
        });
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (closeError) {
                console.error('Error closing pool:', closeError);
            }
        }
    }
});

// Save or update user preference
router.post('/preferences/save', async (req, res) => {
    let pool;
    try {
        const { userId, preferenceKey, preferenceValue } = req.body;
        const { db } = req.query;
        
        console.log(`POST save request: userId=${userId}, key=${preferenceKey}, value=${preferenceValue}, db=${db}`);
        
        if (!db) {
            return res.status(400).json({
                success: false,
                message: 'Database parameter (db) is required'
            });
        }
        
        if (!userId || !preferenceKey || preferenceValue === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, preferenceKey, preferenceValue'
            });
        }
        
        // Get database config based on query parameter
        const dbConfig = dbConfigs[db];
        if (!dbConfig) {
            return res.status(400).json({
                success: false,
                message: `Invalid database: ${db}`
            });
        }
        
        pool = await sql.connect(dbConfig);
        
        // Get the actual UserID from the Users table
        const userInfo = await getActualUserId(pool, userId);
        
        if (!userInfo) {
            return res.status(404).json({
                success: false,
                message: `User not found in Users table with identifier: ${userId}`
            });
        }
        
        console.log(`Saving preference for UserID: ${userInfo.userId}, UserCode: ${userInfo.userCode}`);
        
        // Check if preference exists
        const checkResult = await pool.request()
            .input('userId', sql.Int, userInfo.userId)  // Use Int type
            .input('preferenceKey', sql.NVarChar(100), preferenceKey)
            .query(`
                SELECT PreferenceID 
                FROM UserPreferences 
                WHERE UserID = @userId AND PreferenceKey = @preferenceKey
            `);
        
        let queryResult;
        if (checkResult.recordset.length > 0) {
            // Update existing preference
            queryResult = await pool.request()
                .input('userId', sql.Int, userInfo.userId)  // Use Int type
                .input('preferenceKey', sql.NVarChar(100), preferenceKey)
                .input('preferenceValue', sql.NVarChar(sql.MAX), preferenceValue)
                .query(`
                    UPDATE UserPreferences 
                    SET PreferenceValue = @preferenceValue, UpdatedAt = GETDATE()
                    WHERE UserID = @userId AND PreferenceKey = @preferenceKey
                `);
            console.log(`Updated existing preference for UserID: ${userInfo.userId}`);
        } else {
            // Insert new preference
            queryResult = await pool.request()
                .input('userId', sql.Int, userInfo.userId)  // Use Int type
                .input('preferenceKey', sql.NVarChar(100), preferenceKey)
                .input('preferenceValue', sql.NVarChar(sql.MAX), preferenceValue)
                .query(`
                    INSERT INTO UserPreferences (UserID, PreferenceKey, PreferenceValue, UpdatedAt)
                    VALUES (@userId, @preferenceKey, @preferenceValue, GETDATE())
                `);
            console.log(`Inserted new preference for UserID: ${userInfo.userId}`);
        }
        
        // Verify the save
        const verifyResult = await pool.request()
            .input('userId', sql.Int, userInfo.userId)
            .input('preferenceKey', sql.NVarChar(100), preferenceKey)
            .query(`
                SELECT PreferenceValue 
                FROM UserPreferences 
                WHERE UserID = @userId AND PreferenceKey = @preferenceKey
            `);
        
        res.json({
            success: true,
            message: 'Preference saved successfully',
            rowsAffected: queryResult.rowsAffected[0],
            actualUserId: userInfo.userId,  // Integer UserID
            userCode: userInfo.userCode,    // String User_ID
            username: userInfo.username,
            savedValue: verifyResult.recordset[0]?.PreferenceValue,
            database: db
        });
    } catch (error) {
        console.error('Error saving preference:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving preference',
            error: error.message
        });
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (closeError) {
                console.error('Error closing pool:', closeError);
            }
        }
    }
});

// Get all preferences for a user
router.get('/preferences/:userId', async (req, res) => {
    let pool;
    try {
        const { userId } = req.params;
        const { db } = req.query;
        
        if (!db) {
            return res.status(400).json({
                success: false,
                message: 'Database parameter (db) is required'
            });
        }
        
        // Get database config based on query parameter
        const dbConfig = dbConfigs[db];
        if (!dbConfig) {
            return res.status(400).json({
                success: false,
                message: `Invalid database: ${db}`
            });
        }
        
        pool = await sql.connect(dbConfig);
        
        // Get the actual UserID from the Users table
        const userInfo = await getActualUserId(pool, userId);
        
        if (!userInfo) {
            return res.json({
                success: true,
                preferences: []
            });
        }
        
        const result = await pool.request()
            .input('userId', sql.Int, userInfo.userId)  // Use Int type
            .query(`
                SELECT 
                    PreferenceID,
                    PreferenceKey,
                    PreferenceValue,
                    UpdatedAt
                FROM UserPreferences
                WHERE UserID = @userId
                ORDER BY PreferenceKey
            `);
        
        res.json({
            success: true,
            preferences: result.recordset,
            actualUserId: userInfo.userId,
            userCode: userInfo.userCode,
            username: userInfo.username
        });
    } catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user preferences'
        });
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (closeError) {
                console.error('Error closing pool:', closeError);
            }
        }
    }
});

export default router;