import { Router } from 'express';
import * as employeeController from '#controllers/employee.controller.js';

const router = Router();

router.get('/', employeeController.getAll);
router.get('/:id', employeeController.getById);
router.post('/', employeeController.create);
router.put('/:id', employeeController.update);
router.patch('/:id', employeeController.update);
router.delete('/:id', employeeController.remove);

// Sub-resources
router.get('/:id/contracts', employeeController.getContracts);
router.get('/:id/attendance', employeeController.getAttendance);
router.get('/:id/time-off/requests', employeeController.getTimeOffRequests);
router.get('/:id/time-off/allocations', employeeController.getAllocations);

export default router;
