import { Router } from 'express';
import * as ruleController from '#controllers/salaryRule.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { PAYROLL_READ, PAYROLL_WRITE } from '#lib/roles.js';

const router = Router();

router.get('/:id', requireAuth(...PAYROLL_READ), ruleController.getById);
router.put('/:id', requireAuth(...PAYROLL_WRITE), ruleController.update);
router.patch('/:id', requireAuth(...PAYROLL_WRITE), ruleController.update);
router.delete('/:id', requireAuth(...PAYROLL_WRITE), ruleController.remove);

export default router;
