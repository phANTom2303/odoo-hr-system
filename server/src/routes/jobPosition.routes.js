/**
 * @fileoverview Job Position Routes — HTTP verbs, paths, and controller wiring.
 *
 * Permissions (from business-logic.md §2):
 *   - CRUD: hr_manager, hr_payroll_manager, admin
 *   - Read:  all roles (auth required)
 *
 * Auth/RBAC middleware will be wired in once the auth module is ready (Phase 1).
 * Placeholder comments mark where to insert them.
 */

import { Router } from 'express';
import * as jobPositionController from '#controllers/jobPosition.controller.js';

const router = Router();

// ── Route Definitions ───────────────────────────────────────────────

// GET /api/job-positions
// Access: all authenticated roles
router.get('/', jobPositionController.getAll);

// GET /api/job-positions/:id
// Access: all authenticated roles
router.get('/:id', jobPositionController.getById);

// POST /api/job-positions
// Access: hr_manager, hr_payroll_manager, admin
router.post('/', jobPositionController.create);

// PUT /api/job-positions/:id
// Access: hr_manager, hr_payroll_manager, admin
router.put('/:id', jobPositionController.update);

// PATCH /api/job-positions/:id
// Access: hr_manager, hr_payroll_manager, admin
router.patch('/:id', jobPositionController.patch);

// DELETE /api/job-positions/:id
// Access: hr_manager, hr_payroll_manager, admin
// Blocked at service layer if referenced by active employees or contracts (409)
router.delete('/:id', jobPositionController.remove);

export default router;
