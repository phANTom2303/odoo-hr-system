import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as ruleController from '#controllers/salaryRule.controller.js';

const router = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const updateSchema = z.object({
    code:         z.string().min(1).max(20).optional(),
    name:         z.string().min(1).max(100).trim().optional(),
    category:     z.enum(['basic','allowance','gross','deduction','net']).optional(),
    sequence:     z.coerce.number().int().positive().optional(),
    rule_type:    z.enum(['fixed','percentage']).optional(),
    fixed_amount: z.coerce.number().nullable().optional(),
    percentage:   z.coerce.number().min(0).max(100).nullable().optional(),
    base_rule_id: z.coerce.number().int().positive().nullable().optional(),
}).refine(
    data => Object.values(data).some(v => v !== undefined),
    { message: 'At least one field must be provided' }
);

router.get('/:id',    validate({ params: idParam }),                         ruleController.getById);
router.put('/:id',    validate({ params: idParam, body: updateSchema }),     ruleController.update);
router.patch('/:id',  validate({ params: idParam, body: updateSchema }),     ruleController.update);
router.delete('/:id', validate({ params: idParam }),                         ruleController.remove);

export default router;
