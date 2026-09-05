import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as structureController from '#controllers/salaryStructure.controller.js';
import * as ruleController from '#controllers/salaryRule.controller.js';

const router = Router();

const idParam       = z.object({ id: z.coerce.number().int().positive() });
const structureParam = z.object({ structureId: z.coerce.number().int().positive() });

const createSchema = z.object({
    name:   z.string().min(1).max(100).trim(),
    status: z.enum(['active','inactive']).default('active'),
});

const updateSchema = createSchema.partial().refine(
    data => Object.values(data).some(v => v !== undefined),
    { message: 'At least one field must be provided' }
);

// Salary rule create schema (nested under structure)
const ruleCreateSchema = z.object({
    code:         z.string().min(1).max(20).toUpperCase(),
    name:         z.string().min(1).max(100).trim(),
    category:     z.enum(['basic','allowance','gross','deduction','net']),
    sequence:     z.coerce.number().int().positive(),
    rule_type:    z.enum(['fixed','percentage']),
    fixed_amount: z.coerce.number().optional().nullable(),
    percentage:   z.coerce.number().min(0).max(100).optional().nullable(),
    base_rule_id: z.coerce.number().int().positive().optional().nullable(),
});

// Structures CRUD
router.get('/',    structureController.getAll);
router.get('/:id', validate({ params: idParam }),                        structureController.getById);
router.post('/',   validate({ body: createSchema }),                     structureController.create);
router.put('/:id', validate({ params: idParam, body: updateSchema }),    structureController.update);
router.patch('/:id', validate({ params: idParam, body: updateSchema }),  structureController.update);
router.delete('/:id', validate({ params: idParam }),                     structureController.remove);

// Rules nested under structure
router.get('/:structureId/rules',  validate({ params: structureParam }),                                    ruleController.getByStructure);
router.post('/:structureId/rules', validate({ params: structureParam, body: ruleCreateSchema }),            ruleController.create);

export default router;
