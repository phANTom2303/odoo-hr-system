import { Router } from 'express';
import * as employeeController from '#controllers/employee.controller.js';
import { requireAuth, requireOwnerOrRoles } from '#middlewares/auth.js';
import { HR_ALL, ROLES } from '#lib/roles.js';

const router = Router();

router.get('/', requireAuth(...HR_ALL), employeeController.getAll);
router.get('/:id', requireOwnerOrRoles('id', ...HR_ALL), employeeController.getById);
router.post('/', requireAuth(...HR_ALL), employeeController.create);
router.put('/:id', requireAuth(...HR_ALL), employeeController.update);
router.patch('/:id', requireAuth(...HR_ALL), employeeController.update);
router.delete('/:id', requireAuth(...HR_ALL), employeeController.remove);

// Sub-resources
router.get('/:id/contracts', requireOwnerOrRoles('id', ...HR_ALL), employeeController.getContracts);
router.get('/:id/attendance', requireOwnerOrRoles('id', ...HR_ALL), employeeController.getAttendance);
router.get('/:id/time-off/requests', requireOwnerOrRoles('id', ...HR_ALL), employeeController.getTimeOffRequests);
router.get('/:id/time-off/allocations', requireOwnerOrRoles('id', ...HR_ALL), employeeController.getAllocations);

export default router;
