import { Router } from 'express';
import * as attendanceController from '#controllers/attendance.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { ALL_ROLES, HR_ALL } from '#lib/roles.js';

const router = Router();

// ── Self-service (every logged-in user) ──────────────────────────────────────

/** Restore today's check-in state on page load / refresh */
router.get('/today',    requireAuth(...ALL_ROLES), attendanceController.getToday);

/** Clock in for today */
router.post('/checkin', requireAuth(...ALL_ROLES), attendanceController.checkIn);

/** Clock out for today */
router.post('/checkout', requireAuth(...ALL_ROLES), attendanceController.checkOut);

// DEV ONLY — remove before going to production
router.post('/reset-today', requireAuth(...ALL_ROLES), attendanceController.resetToday);

// ── HR / Admin read access ────────────────────────────────────────────────────

router.get('/',    requireAuth(...ALL_ROLES), attendanceController.getAll);
router.get('/:id', requireAuth(...ALL_ROLES), attendanceController.getById);

/** PUT /api/attendance/:id — HR manual correction */
router.put('/:id', requireAuth(...HR_ALL), attendanceController.manualUpdate);

export default router;
