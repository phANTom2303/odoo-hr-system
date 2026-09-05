/**
 * @fileoverview Job Position Routes — HTTP verbs, paths, Zod validation, and controller wiring.
 *
 * Permissions (from business-logic.md §2):
 *   - CRUD: hr_manager, hr_payroll_manager, admin
 *   - Read:  all roles (auth required)
 *
 * Auth/RBAC middleware will be wired in once the auth module is ready (Phase 1).
 * Placeholder comments mark where to insert them.
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as jobPositionController from '#controllers/jobPosition.controller.js';

const router = Router();

// ── Zod Schemas ─────────────────────────────────────────────────────

/** Validates :id param is a valid UUID. */
const idParamSchema = z.object({
    id: z.string().uuid({ message: 'id must be a valid UUID' }),
});

/** POST — full create payload. */
const createSchema = z.object({
    title: z
        .string({ required_error: 'title is required' })
        .min(1, 'title cannot be empty')
        .max(150, 'title must be 150 characters or fewer')
        .trim(),
    department_id: z
        .string()
        .uuid({ message: 'department_id must be a valid UUID' })
        .nullable()
        .optional(),
});

/** PUT — full replacement (title required, department_id optional). */
const updateSchema = z.object({
    title: z
        .string({ required_error: 'title is required' })
        .min(1, 'title cannot be empty')
        .max(150, 'title must be 150 characters or fewer')
        .trim(),
    department_id: z
        .string()
        .uuid({ message: 'department_id must be a valid UUID' })
        .nullable()
        .optional(),
});

/** PATCH — partial update (at least one field must be present). */
const patchSchema = z
    .object({
        title: z.string().min(1).max(150).trim().optional(),
        department_id: z
            .string()
            .uuid({ message: 'department_id must be a valid UUID' })
            .nullable()
            .optional(),
    })
    .refine(
        (data) => Object.values(data).some((v) => v !== undefined),
        { message: 'At least one field must be provided' }
    );

// ── Route Definitions ───────────────────────────────────────────────

// GET /api/job-positions
// Access: all authenticated roles
router.get('/', jobPositionController.getAll);

// GET /api/job-positions/:id
// Access: all authenticated roles
router.get(
    '/:id',
    validate({ params: idParamSchema }),
    jobPositionController.getById
);

// POST /api/job-positions
// Access: hr_manager, hr_payroll_manager, admin
router.post(
    '/',
    validate({ body: createSchema }),
    jobPositionController.create
);

// PUT /api/job-positions/:id
// Access: hr_manager, hr_payroll_manager, admin
router.put(
    '/:id',
    validate({ params: idParamSchema, body: updateSchema }),
    jobPositionController.update
);

// PATCH /api/job-positions/:id
// Access: hr_manager, hr_payroll_manager, admin
router.patch(
    '/:id',
    validate({ params: idParamSchema, body: patchSchema }),
    jobPositionController.patch
);

// DELETE /api/job-positions/:id
// Access: hr_manager, hr_payroll_manager, admin
// Blocked at service layer if referenced by active employees or contracts (409)
router.delete(
    '/:id',
    validate({ params: idParamSchema }),
    jobPositionController.remove
);

export default router;
