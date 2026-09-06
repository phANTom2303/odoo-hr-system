/**
 * @fileoverview Pay Run Routes
 */

import { Router } from 'express';
import * as payRunController from '#controllers/payRun.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { PAYROLL_READ, PAYROLL_WRITE, PAY_RUN_WRITE } from '#lib/roles.js';

const router = Router();

router.get('/', requireAuth(...PAYROLL_READ), payRunController.getAll);
router.post('/', requireAuth(...PAY_RUN_WRITE), payRunController.create);

// Must be registered before '/:id', otherwise Express matches 'eligible-employees' as an :id.
router.get('/eligible-employees', requireAuth(...PAY_RUN_WRITE), payRunController.getEligibleEmployees);

router.get('/:id', requireAuth(...PAYROLL_READ), payRunController.getById);
router.put('/:id', requireAuth(...PAY_RUN_WRITE), payRunController.updateMeta);
router.delete('/:id', requireAuth(...PAYROLL_WRITE), payRunController.remove);

router.post('/:id/compute', requireAuth(...PAYROLL_WRITE), payRunController.compute);
router.post('/:id/validate', requireAuth(...PAYROLL_WRITE), payRunController.validate);
router.post('/:id/mark-paid', requireAuth(...PAYROLL_WRITE), payRunController.markPaid);

export default router;
