import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from '#config/db.js';
import { logger } from '#config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reads init.sql and executes it against the database.
 * The SQL is fully idempotent (CREATE IF NOT EXISTS, ON CONFLICT DO NOTHING),
 * so it is safe to run on every server startup.
 */
export const initDatabase = async () => {
    try {
        const sqlPath = join(__dirname, 'init.sql');
        const sql = readFileSync(sqlPath, 'utf-8');
        await pool.query(sql);
        logger.info('Database schema initialized successfully');
    } catch (error) {
        logger.error(`Database initialization failed: ${error.message}`);
        throw error;
    }
};
