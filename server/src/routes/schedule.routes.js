import { Router } from 'express';
import * as scheduleController from '#controllers/schedule.controller.js';

const router = Router();

router.get('/', scheduleController.getAll);
router.get('/:id', scheduleController.getById);
router.post('/', scheduleController.create);
router.put('/:id', scheduleController.update);
router.patch('/:id', scheduleController.update);
router.delete('/:id', scheduleController.remove);

export default router;
