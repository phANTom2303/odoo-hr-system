import { Router } from 'express';
import * as scheduleController from '#controllers/schedule.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { HR_ALL, ALL_ROLES } from '#lib/roles.js';

const router = Router();

router.get('/', requireAuth(...ALL_ROLES), scheduleController.getAll);
router.get('/:id', requireAuth(...ALL_ROLES), scheduleController.getById);
router.post('/', requireAuth(...HR_ALL), scheduleController.create);
router.put('/:id', requireAuth(...HR_ALL), scheduleController.update);
router.patch('/:id', requireAuth(...HR_ALL), scheduleController.update);
router.delete('/:id', requireAuth(...HR_ALL), scheduleController.remove);

export default router;
