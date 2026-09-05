/**
 * @fileoverview Contract Routes
 */

import { Router } from 'express';
import * as contractController from '#controllers/contract.controller.js';

const router = Router();

router.get('/', contractController.getAll);
router.get('/:id', contractController.getById);
router.post('/', contractController.createContract);
router.put('/:id', contractController.updateContract);

export default router;
