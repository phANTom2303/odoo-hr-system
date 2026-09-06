/**
 * @fileoverview Audit Log Routes
 */

import { Router } from 'express';
import * as auditController from '#controllers/audit.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { ADMIN_ONLY } from '#lib/roles.js';

const router = Router();

router.get('/', requireAuth(...ADMIN_ONLY), auditController.getRecent);

export default router;
