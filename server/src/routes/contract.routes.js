/**
 * @fileoverview Contract Routes
 */

import { Router } from 'express';
import * as contractController from '#controllers/contract.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { HR_ALL } from '#lib/roles.js';

const router = Router();

router.get('/', requireAuth(...HR_ALL), contractController.getAll);
router.get('/:id', requireAuth(...HR_ALL), contractController.getById);
router.post('/', requireAuth(...HR_ALL), contractController.createContract);
router.put('/:id', requireAuth(...HR_ALL), contractController.updateContract);

export default router;
