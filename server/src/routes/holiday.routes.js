import { Router } from 'express';
import * as holidayController from '#controllers/holiday.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { HR_ALL, ALL_ROLES } from '#lib/roles.js';

const router = Router();

router.get('/', requireAuth(...ALL_ROLES), holidayController.getAll);
router.get('/:id', requireAuth(...ALL_ROLES), holidayController.getById);
router.post('/', requireAuth(...HR_ALL), holidayController.create);
router.put('/:id', requireAuth(...HR_ALL), holidayController.update);
router.patch('/:id', requireAuth(...HR_ALL), holidayController.update);
router.delete('/:id', requireAuth(...HR_ALL), holidayController.remove);

export default router;
