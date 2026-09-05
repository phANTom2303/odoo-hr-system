/**
 * @fileoverview Task Routes — HTTP verbs, paths, and controller wiring.
 * No business logic.
 */

import { Router } from 'express';
import * as taskController from '#controllers/task.controller.js';

const router = Router();

// ── Routes ──────────────────────────────────────────────────────────

// List all tasks
router.get('/', taskController.getAllTasks);

// Get a single task
router.get('/:id', taskController.getTaskById);

// Create a task
router.post('/', taskController.createTask);

// Full update
router.put('/:id', taskController.updateTask);

// Partial update
router.patch('/:id', taskController.updateTask);

// Delete a task
router.delete('/:id', taskController.deleteTask);

export default router;
