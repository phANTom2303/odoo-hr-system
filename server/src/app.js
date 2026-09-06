import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { logger } from '#config/logger.js';
import { RESPONSE_CODES } from '#lib/common.js';
import { AppError } from '#lib/errors.js';
import { initDatabase } from '#config/initDb.js';

// ── Routers ──────────────────────────────────────────────────────────
import authRouter            from '#routes/auth.routes.js';
import contractRouter        from '#routes/contract.routes.js';
import departmentRouter      from '#routes/department.routes.js';
import jobPositionRouter     from '#routes/jobPosition.routes.js';
import employeeRouter        from '#routes/employee.routes.js';
import scheduleRouter        from '#routes/schedule.routes.js';
import timeOffTypeRouter     from '#routes/timeOffType.routes.js';
import holidayRouter         from '#routes/holiday.routes.js';
import salaryStructureRouter from '#routes/salaryStructure.routes.js';
import salaryRuleRouter      from '#routes/salaryRule.routes.js';
import attendanceRouter      from '#routes/attendance.routes.js';
import allocationRouter      from '#routes/allocation.routes.js';
import leaveRequestRouter    from '#routes/leaveRequest.routes.js';

const app = express();

app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,  // Required for cookies to be sent cross-origin
}));
app.use(express.json());
app.use(cookieParser()); // Parses req.cookies — required by requireAuth middleware

await initDatabase();

// ── Route Mounts ─────────────────────────────────────────────────────
app.use('/api/auth',              authRouter);
app.use('/api/contracts',         contractRouter);
app.use('/api/departments',       departmentRouter);
app.use('/api/job-positions',     jobPositionRouter);
app.use('/api/employees',         employeeRouter);
app.use('/api/schedules',         scheduleRouter);
app.use('/api/time-off-types',    timeOffTypeRouter);
app.use('/api/holidays',          holidayRouter);
app.use('/api/salary-structures', salaryStructureRouter);
app.use('/api/salary-rules',      salaryRuleRouter);
app.use('/api/attendance',        attendanceRouter);
app.use('/api/allocations',       allocationRouter);
app.use('/api/leave-requests',    leaveRequestRouter);

// ── Global Error Handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
    if (err instanceof AppError && err.isOperational) {
        logger.warn(`Operational Error [${err.status}]: ${err.message}`);
        return res.status(err.status).json({ success: false, error: err.message });
    }
    logger.error(`Unanticipated ERROR: ${err.message}\nStack: ${err.stack}`);
    return res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR_CODE).json({
        success: false,
        error: 'An unexpected internal server error occurred.',
    });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
