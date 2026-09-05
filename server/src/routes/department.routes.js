/**
 * @fileoverview Department Routes — HTTP verbs, paths, Zod validation, and controller wiring.
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
import * as departmentController from '#controllers/department.controller.js';

const router = Router();

// ── Zod Schemas ─────────────────────────────────────────────────────

/** Validates :id param is a valid UUID. */
const idParamSchema = z.object({
    id: z.string().uuid({ message: 'id must be a valid UUID' }),
});

/** POST — full create payload. */
const createSchema = z.object({
    name: z
        .string({ required_error: 'name is required' })
        .min(1, 'name cannot be empty')
        .max(100, 'name must be 100 characters or fewer')
        .trim(),
});

/** PUT — full replacement (name required). */
const updateSchema = z.object({
    name: z
        .string({ required_error: 'name is required' })
        .min(1, 'name cannot be empty')
        .max(100, 'name must be 100 characters or fewer')
        .trim(),
});

/** PATCH — partial update (at least one field must be present). */
const patchSchema = z
    .object({
        name: z.string().min(1).max(100).trim().optional(),
    })
    .refine(
        (data) => Object.values(data).some((v) => v !== undefined),
        { message: 'At least one field must be provided' }
    );

// ── Route Definitions ───────────────────────────────────────────────

// GET /api/departments
// Access: all authenticated roles
router.get('/', departmentController.getAll);

// GET /api/departments/:id
// Access: all authenticated roles
router.get(
    '/:id',
    validate({ params: idParamSchema }),
    departmentController.getById
);

// POST /api/departments
// Access: hr_manager, hr_payroll_manager, admin
router.post(
    '/',
    validate({ body: createSchema }),
    departmentController.create
);

// PUT /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
router.put(
    '/:id',
    validate({ params: idParamSchema, body: updateSchema }),
    departmentController.update
);

// PATCH /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
router.patch(
    '/:id',
    validate({ params: idParamSchema, body: patchSchema }),
    departmentController.patch
);

// DELETE /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
// Blocked at service layer if referenced by active employees or contracts (409)
router.delete(
    '/:id',
    validate({ params: idParamSchema }),
    departmentController.remove
);

export default router;
