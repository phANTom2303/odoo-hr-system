import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; // Standard security headers
import { logger } from '#config/logger.js';
import { RESPONSE_CODES } from '#lib/common.js';
import { AppError } from '#lib/errors.js';
import taskRouter from '#routes/task.routes.js';
import contractRouter from '#routes/contract.routes.js';
import { initDatabase } from '#config/initDb.js';

const app = express();

// Global Middlewares
app.use(helmet());
app.use(cors({
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Parse incoming JSON payloads

// await initRedis();
await initDatabase();

// ── Route Mounts ────────────────────────────────────────────────────
app.use('/api/tasks', taskRouter);
app.use('/api/contracts', contractRouter);

// Global Error Handler (Good practice for a security platform)
app.use((err, req, res, next) => {
    if (err instanceof AppError && err.isOperational) {
        logger.warn(`Operational Error [${err.status}]: ${err.message}`);

        return res.status(err.status).json({
            success: false,
            error: err.message
        });
    }

    logger.error(`Unanticipated ERROR: ${err.message}\nStack: ${err.stack}`);

    return res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR_CODE).json({
        success: false,
        error: "An unexpected internal server error occurred."
    });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    logger.info(`Server is running on Port ${PORT}`);
});
