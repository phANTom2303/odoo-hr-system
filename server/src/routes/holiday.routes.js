import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as holidayController from '#controllers/holiday.controller.js';

const router = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
    name:         z.string().min(1).max(100).trim(),
    date:         z.string().date('date must be a valid ISO date (YYYY-MM-DD)'),
    holiday_type: z.enum(['national','festival','company']).default('national'),
    is_paid:      z.boolean().default(true),
});

const updateSchema = createSchema.partial().refine(
    data => Object.values(data).some(v => v !== undefined),
    { message: 'At least one field must be provided' }
);

router.get('/',    holidayController.getAll);
router.get('/:id', validate({ params: idParam }),                          holidayController.getById);
router.post('/',   validate({ body: createSchema }),                       holidayController.create);
router.put('/:id', validate({ params: idParam, body: updateSchema }),      holidayController.update);
router.patch('/:id', validate({ params: idParam, body: updateSchema }),    holidayController.update);
router.delete('/:id', validate({ params: idParam }),                       holidayController.remove);

export default router;
