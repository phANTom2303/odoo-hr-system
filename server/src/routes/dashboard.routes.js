/**
 * @fileoverview Dashboard Routes
 */

import { Router } from 'express';
import * as dashboardController from '#controllers/dashboard.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { HR_ALL } from '#lib/roles.js';

const router = Router();

router.get('/summary', requireAuth(...HR_ALL), dashboardController.getSummary);

export default router;
