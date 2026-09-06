import { Router } from 'express';
import * as allocationController from '#controllers/allocation.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { ALL_ROLES, HR_ALL } from '#lib/roles.js';

const router = Router();

// Any logged-in user can view allocations (employees see their own via employee_id filter)
router.get('/',    requireAuth(...ALL_ROLES), allocationController.getAll);
router.get('/:id', requireAuth(...ALL_ROLES), allocationController.getById);

// Only HR / admin can create, delete, approve, refuse
router.post('/',               requireAuth(...HR_ALL), allocationController.create);
router.put('/:id',             requireAuth(...HR_ALL), allocationController.update);
router.delete('/:id',          requireAuth(...HR_ALL), allocationController.remove);
router.post('/:id/approve',    requireAuth(...HR_ALL), allocationController.approve);
router.post('/:id/refuse',     requireAuth(...HR_ALL), allocationController.refuse);

export default router;
