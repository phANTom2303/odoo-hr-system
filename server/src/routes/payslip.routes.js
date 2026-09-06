/**
 * @fileoverview Payslip Routes
 */

import { Router } from 'express';
import * as payslipController from '#controllers/payslip.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { ALL_ROLES, PAY_RUN_WRITE } from '#lib/roles.js';

const router = Router();

// Employees can read their own payslips; the controller scopes the query to
// req.user.sub and rejects anyone else's payslip (see payslip.controller.js).
router.get('/', requireAuth(...ALL_ROLES), payslipController.getAll);
router.get('/:id', requireAuth(...ALL_ROLES), payslipController.getById);
router.post('/:id/review', requireAuth(...PAY_RUN_WRITE), payslipController.review);
router.post('/:id/manual-lines', requireAuth(...PAY_RUN_WRITE), payslipController.addManualLine);
router.post('/:id/cancel', requireAuth(...PAY_RUN_WRITE), payslipController.cancel);

export default router;
