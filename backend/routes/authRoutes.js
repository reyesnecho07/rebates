// routes/authRoutes.js
import express from 'express';
import { login, changeUserPassword } from '../controllers/authController.js';

const router = express.Router();

// Login endpoint - only checks UsersDB_v1.1
router.post('/login', login);

// Change password endpoint - only updates UsersDB_v1.1
router.post('/change-password', changeUserPassword);

export default router;