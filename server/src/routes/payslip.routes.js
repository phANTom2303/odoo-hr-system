/**
 * @fileoverview Payslip Routes
 */

import { Router } from 'express';
import * as payslipController from '#controllers/payslip.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { PAYROLL_READ, PAY_RUN_WRITE } from '#lib/roles.js';

const router = Router();

router.get('/', requireAuth(...PAYROLL_READ), payslipController.getAll);
router.get('/:id', requireAuth(...PAYROLL_READ), payslipController.getById);
router.post('/:id/review', requireAuth(...PAY_RUN_WRITE), payslipController.review);
router.post('/:id/manual-lines', requireAuth(...PAY_RUN_WRITE), payslipController.addManualLine);
router.post('/:id/cancel', requireAuth(...PAY_RUN_WRITE), payslipController.cancel);

export default router;
