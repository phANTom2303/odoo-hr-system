import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as employeeController from '#controllers/employee.controller.js';

const router = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
    first_name:        z.string().min(1).max(100).trim(),
    last_name:         z.string().min(1).max(100).trim(),
    email:             z.string().email(),
    password:          z.string().min(6),
    phone:             z.string().max(20).optional(),
    role:              z.enum(['employee','hr_manager','hr_payroll_user','hr_payroll_manager','admin']).optional(),
    employment_status: z.enum(['active','on_notice','terminated']).optional(),
    employee_type:     z.enum(['full_time','part_time','contract','intern']).optional(),
    department_id:     z.coerce.number().int().positive().nullable().optional(),
    job_position_id:   z.coerce.number().int().positive().nullable().optional(),
    manager_id:        z.coerce.number().int().positive().nullable().optional(),
    date_of_joining:   z.string().date().optional(),
    date_of_birth:     z.string().date().optional(),
    bank_name:         z.string().max(100).optional(),
    bank_account:      z.string().max(50).optional(),
    address:           z.string().optional(),
});

const updateSchema = createSchema.partial().omit({ password: true }).extend({
    password: z.string().min(6).optional(),
    is_active: z.boolean().optional(),
    date_of_leaving: z.string().date().nullable().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
    message: 'At least one field must be provided',
});

const querySchema = z.object({
    search:     z.string().optional(),
    department: z.string().optional(),
    status:     z.enum(['active','inactive']).optional(),
    role:       z.string().optional(),
});

router.get('/',    validate({ query: querySchema }),                        employeeController.getAll);
router.get('/:id', validate({ params: idParam }),                           employeeController.getById);
router.post('/',   validate({ body: createSchema }),                        employeeController.create);
router.put('/:id', validate({ params: idParam, body: updateSchema }),       employeeController.update);
router.patch('/:id', validate({ params: idParam, body: updateSchema }),     employeeController.update);
router.delete('/:id', validate({ params: idParam }),                        employeeController.remove);

// Sub-resources
router.get('/:id/contracts',             validate({ params: idParam }), employeeController.getContracts);
router.get('/:id/attendance',            validate({ params: idParam }), employeeController.getAttendance);
router.get('/:id/time-off/requests',     validate({ params: idParam }), employeeController.getTimeOffRequests);
router.get('/:id/time-off/allocations',  validate({ params: idParam }), employeeController.getAllocations);

export default router;
