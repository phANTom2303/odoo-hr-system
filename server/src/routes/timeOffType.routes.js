import { Router } from 'express';
import * as typeController from '#controllers/timeOffType.controller.js';

const router = Router();

router.get('/', typeController.getAll);
router.get('/:id', typeController.getById);
router.post('/', typeController.create);
router.put('/:id', typeController.update);
router.patch('/:id', typeController.update);
router.delete('/:id', typeController.remove);

export default router;
