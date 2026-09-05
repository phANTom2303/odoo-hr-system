import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as typeController from '#controllers/timeOffType.controller.js';

const router = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
    name:                z.string().min(1).max(100).trim(),
    unit:                z.enum(['days','hours']).default('days'),
    requires_allocation: z.boolean().default(true),
    approval_required:   z.boolean().default(true),
    approver_role:       z.enum(['employee','hr_manager','hr_payroll_user','hr_payroll_manager','admin']).default('hr_manager'),
    leave_validation:    z.enum(['no_validation','hr','manager','both']).default('manager'),
    attendance_impact:   z.enum(['absent','present','none']).default('absent'),
    is_paid:             z.boolean().default(true),
    is_active:           z.boolean().default(true),
});

const updateSchema = createSchema.partial().refine(
    data => Object.values(data).some(v => v !== undefined),
    { message: 'At least one field must be provided' }
);

router.get('/',    typeController.getAll);
router.get('/:id', validate({ params: idParam }),                          typeController.getById);
router.post('/',   validate({ body: createSchema }),                       typeController.create);
router.put('/:id', validate({ params: idParam, body: updateSchema }),      typeController.update);
router.patch('/:id', validate({ params: idParam, body: updateSchema }),    typeController.update);
router.delete('/:id', validate({ params: idParam }),                       typeController.remove);

export default router;
