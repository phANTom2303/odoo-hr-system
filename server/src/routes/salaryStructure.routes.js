import { Router } from 'express';
import * as structureController from '#controllers/salaryStructure.controller.js';
import * as ruleController from '#controllers/salaryRule.controller.js';

const router = Router();

// Structures CRUD
router.get('/', structureController.getAll);
router.get('/:id', structureController.getById);
router.post('/', structureController.create);
router.put('/:id', structureController.update);
router.patch('/:id', structureController.update);
router.delete('/:id', structureController.remove);

// Rules nested under structure
router.get('/:structureId/rules', ruleController.getByStructure);
router.post('/:structureId/rules', ruleController.create);

export default router;
