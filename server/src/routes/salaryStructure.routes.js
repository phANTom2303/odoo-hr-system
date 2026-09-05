import { Router } from 'express';
import * as structureController from '#controllers/salaryStructure.controller.js';
import * as ruleController from '#controllers/salaryRule.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { PAYROLL_READ, PAYROLL_WRITE } from '#lib/roles.js';

const router = Router();

// Structures CRUD
router.get('/', requireAuth(...PAYROLL_READ), structureController.getAll);
router.get('/:id', requireAuth(...PAYROLL_READ), structureController.getById);
router.post('/', requireAuth(...PAYROLL_WRITE), structureController.create);
router.put('/:id', requireAuth(...PAYROLL_WRITE), structureController.update);
router.patch('/:id', requireAuth(...PAYROLL_WRITE), structureController.update);
router.delete('/:id', requireAuth(...PAYROLL_WRITE), structureController.remove);

// Rules nested under structure
router.get('/:structureId/rules', requireAuth(...PAYROLL_READ), ruleController.getByStructure);
router.post('/:structureId/rules', requireAuth(...PAYROLL_WRITE), ruleController.create);

export default router;
