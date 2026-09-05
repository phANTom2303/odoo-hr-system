import { Router } from 'express';
import * as authController from '#controllers/auth.controller.js';
import { requireAuth } from '#middlewares/auth.js';

const router = Router();

// Public routes (no JWT required)
router.post('/login',  authController.login);
router.post('/logout', authController.logout);

// Protected route — bootstraps client session after page reload
router.get('/me', requireAuth(), authController.getMe);

export default router;
