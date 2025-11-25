import express from 'express';
import { login, simpleLogin } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.post('/login', asyncHandler(login));
router.post('/simple-login', asyncHandler(simpleLogin));

export default router;