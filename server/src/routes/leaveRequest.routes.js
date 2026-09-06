import { Router } from 'express';
import * as leaveController from '#controllers/leaveRequest.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { ALL_ROLES, HR_ALL } from '#lib/roles.js';

const router = Router();

// Any logged-in user can view and create leave requests (employees submit their own)
router.get('/',    requireAuth(...ALL_ROLES), leaveController.getAll);
router.get('/:id', requireAuth(...ALL_ROLES), leaveController.getById);
router.post('/',   requireAuth(...ALL_ROLES), leaveController.create);

// Withdraw — employee can withdraw their own request
router.post('/:id/withdraw', requireAuth(...ALL_ROLES), leaveController.withdraw);

// Approve / refuse — HR and admin only
router.post('/:id/approve', requireAuth(...HR_ALL), leaveController.approve);
router.post('/:id/refuse',  requireAuth(...HR_ALL), leaveController.refuse);

export default router;
