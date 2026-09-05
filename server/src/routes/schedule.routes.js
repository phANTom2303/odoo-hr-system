import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as scheduleController from '#controllers/schedule.controller.js';

const router = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const lineSchema = z.object({
    day_of_week:    z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']),
    start_time:     z.string().regex(/^\d{2}:\d{2}$/, 'start_time must be HH:MM'),
    end_time:       z.string().regex(/^\d{2}:\d{2}$/, 'end_time must be HH:MM'),
    break_minutes:  z.coerce.number().int().min(0).default(0),
});

const createSchema = z.object({
    name:  z.string().min(1).max(100).trim(),
    lines: z.array(lineSchema).min(1, 'At least one schedule line is required'),
});

const updateSchema = z.object({
    name:      z.string().min(1).max(100).trim().optional(),
    is_active: z.boolean().optional(),
    lines:     z.array(lineSchema).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
    message: 'At least one field must be provided',
});

router.get('/',    scheduleController.getAll);
router.get('/:id', validate({ params: idParam }),                          scheduleController.getById);
router.post('/',   validate({ body: createSchema }),                       scheduleController.create);
router.put('/:id', validate({ params: idParam, body: updateSchema }),      scheduleController.update);
router.patch('/:id', validate({ params: idParam, body: updateSchema }),    scheduleController.update);
router.delete('/:id', validate({ params: idParam }),                       scheduleController.remove);

export default router;
