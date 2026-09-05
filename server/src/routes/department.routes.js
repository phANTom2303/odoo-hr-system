/**
 * @fileoverview Department Routes — HTTP verbs, paths, and controller wiring.
 *
 * Permissions (from business-logic.md §2):
 *   - CRUD: hr_manager, hr_payroll_manager, admin
 *   - Read:  all roles (auth required)
 *
 * Auth/RBAC middleware will be wired in once the auth module is ready (Phase 1).
 * Placeholder comments mark where to insert them.
 */

import { Router } from 'express';
import * as departmentController from '#controllers/department.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { HR_ALL, ALL_ROLES } from '#lib/roles.js';

const router = Router();

// ── Route Definitions ───────────────────────────────────────────────

// GET /api/departments
// Access: all authenticated roles
router.get('/', requireAuth(...ALL_ROLES), departmentController.getAll);

// GET /api/departments/:id
// Access: all authenticated roles
router.get('/:id', requireAuth(...ALL_ROLES), departmentController.getById);

// POST /api/departments
// Access: hr_manager, hr_payroll_manager, admin
router.post('/', requireAuth(...HR_ALL), departmentController.create);

// PUT /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
router.put('/:id', requireAuth(...HR_ALL), departmentController.update);

// PATCH /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
router.patch('/:id', requireAuth(...HR_ALL), departmentController.patch);

// DELETE /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
// Blocked at service layer if referenced by active employees or contracts (409)
router.delete('/:id', requireAuth(...HR_ALL), departmentController.remove);

export default router;
