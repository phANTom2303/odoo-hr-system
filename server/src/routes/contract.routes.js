/**
 * @fileoverview Contract Routes
 */

import { Router } from 'express';
import * as contractController from '#controllers/contract.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { HR_ALL, ALL_ROLES } from '#lib/roles.js';

const router = Router();

// Employees can view their own contracts; HR can view all
router.get('/',    requireAuth(...ALL_ROLES), contractController.getAll);
router.get('/:id', requireAuth(...ALL_ROLES), contractController.getById);
router.post('/',   requireAuth(...HR_ALL),    contractController.createContract);
router.put('/:id', requireAuth(...HR_ALL),    contractController.updateContract);
router.delete('/:id', requireAuth(...HR_ALL), contractController.deleteContract);

export default router;
