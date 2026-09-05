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

const router = Router();

// ── Route Definitions ───────────────────────────────────────────────

// GET /api/departments
// Access: all authenticated roles
router.get('/', departmentController.getAll);

// GET /api/departments/:id
// Access: all authenticated roles
router.get('/:id', departmentController.getById);

// POST /api/departments
// Access: hr_manager, hr_payroll_manager, admin
router.post('/', departmentController.create);

// PUT /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
router.put('/:id', departmentController.update);

// PATCH /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
router.patch('/:id', departmentController.patch);

// DELETE /api/departments/:id
// Access: hr_manager, hr_payroll_manager, admin
// Blocked at service layer if referenced by active employees or contracts (409)
router.delete('/:id', departmentController.remove);

export default router;
