/**
 * @fileoverview Task Controller — HTTP interface layer.
 * Extracts data from req, delegates to the service, returns standardized responses.
 * Every handler is wrapped in asyncHandler to forward errors to the global error handler.
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as taskService from '#services/task.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/**
 * GET /api/tasks
 * Returns all tasks.
 */
export const getAllTasks = asyncHandler(async (req, res) => {
    const tasks = await taskService.getAllTasks();

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: tasks.length,
        data: tasks,
    });
});

/**
 * GET /api/tasks/:id
 * Returns a single task by UUID.
 */
export const getTaskById = asyncHandler(async (req, res) => {
    const task = await taskService.getTaskById(req.params.id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: task,
    });
});

/**
 * POST /api/tasks
 * Creates a new task. Expects { title, description?, status? } in body.
 */
export const createTask = asyncHandler(async (req, res) => {
    const { title, description, status } = req.body;
    const task = await taskService.createTask({ title, description, status });

    res.status(RESPONSE_CODES.CREATED_CODE).json({
        success: true,
        data: task,
    });
});

/**
 * PUT /api/tasks/:id  |  PATCH /api/tasks/:id
 * Updates a task. Accepts partial or full body.
 */
export const updateTask = asyncHandler(async (req, res) => {
    const { title, description, status } = req.body;
    const task = await taskService.updateTask(req.params.id, {
        title,
        description,
        status,
    });

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: task,
    });
});

/**
 * DELETE /api/tasks/:id
 * Deletes a task. Returns 204 No Content on success.
 */
export const deleteTask = asyncHandler(async (req, res) => {
    await taskService.deleteTask(req.params.id);

    res.status(204).end();
});
