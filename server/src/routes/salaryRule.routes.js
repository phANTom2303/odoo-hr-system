import { Router } from 'express';
import * as ruleController from '#controllers/salaryRule.controller.js';

const router = Router();

router.get('/:id', ruleController.getById);
router.put('/:id', ruleController.update);
router.patch('/:id', ruleController.update);
router.delete('/:id', ruleController.remove);

export default router;
