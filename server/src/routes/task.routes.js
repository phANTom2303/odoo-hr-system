/**
 * @fileoverview Task Routes — HTTP verbs, paths, validation, and controller wiring.
 * No business logic. Zod schemas defined here for co-location with the routes they guard.
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as taskController from '#controllers/task.controller.js';

const router = Router();

// ── Zod Schemas ─────────────────────────────────────────────────────

const statusEnum = z.enum(['pending', 'in_progress', 'completed']);

/** Validates :id param is a valid UUID. */
const idParamSchema = z.object({
    id: z.string().uuid({ message: 'id must be a valid UUID' }),
});

/** POST /tasks — full create payload. */
const createTaskSchema = z.object({
    title: z.string().min(1, 'title is required').max(255),
    description: z.string().optional(),
    status: statusEnum.default('pending'),
});

/** PUT /tasks/:id — full replacement (all required fields). */
const updateTaskSchema = z.object({
    title: z.string().min(1, 'title is required').max(255),
    description: z.string().optional(),
    status: statusEnum.default('pending'),
});

/** PATCH /tasks/:id — partial update (at least one field must be present). */
const patchTaskSchema = z
    .object({
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        status: statusEnum.optional(),
    })
    .refine(
        (data) => Object.values(data).some((v) => v !== undefined),
        { message: 'At least one field (title, description, status) must be provided' }
    );

// ── Routes ──────────────────────────────────────────────────────────

// List all tasks
router.get('/', taskController.getAllTasks);

// Get a single task
router.get('/:id', validate({ params: idParamSchema }), taskController.getTaskById);

// Create a task
router.post('/', validate({ body: createTaskSchema }), taskController.createTask);

// Full update
router.put(
    '/:id',
    validate({ params: idParamSchema, body: updateTaskSchema }),
    taskController.updateTask
);

// Partial update
router.patch(
    '/:id',
    validate({ params: idParamSchema, body: patchTaskSchema }),
    taskController.updateTask
);

// Delete a task
router.delete('/:id', validate({ params: idParamSchema }), taskController.deleteTask);

export default router;
