import { Router } from 'express';
import * as typeController from '#controllers/timeOffType.controller.js';
import { requireAuth } from '#middlewares/auth.js';
import { HR_ALL, ALL_ROLES } from '#lib/roles.js';

const router = Router();

router.get('/', requireAuth(...ALL_ROLES), typeController.getAll);
router.get('/:id', requireAuth(...ALL_ROLES), typeController.getById);
router.post('/', requireAuth(...HR_ALL), typeController.create);
router.put('/:id', requireAuth(...HR_ALL), typeController.update);
router.patch('/:id', requireAuth(...HR_ALL), typeController.update);
router.delete('/:id', requireAuth(...HR_ALL), typeController.remove);

export default router;
