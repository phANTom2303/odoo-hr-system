import { Router } from 'express';
import * as holidayController from '#controllers/holiday.controller.js';

const router = Router();

router.get('/', holidayController.getAll);
router.get('/:id', holidayController.getById);
router.post('/', holidayController.create);
router.put('/:id', holidayController.update);
router.patch('/:id', holidayController.update);
router.delete('/:id', holidayController.remove);

export default router;
