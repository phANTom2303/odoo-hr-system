/**
 * @fileoverview Working Schedule Repository
 * Handles working_schedules + schedule_lines (child rows).
 */

import { query, transaction } from '#config/db.js';

export const findAll = async () => {
    const sql = `
        SELECT
            ws.*,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', sl.id, 'day_of_week', sl.day_of_week,
                        'start_time', sl.start_time, 'end_time', sl.end_time,
                        'break_minutes', sl.break_minutes, 'is_active', sl.is_active
                    ) ORDER BY sl.day_of_week
                ) FILTER (WHERE sl.id IS NOT NULL),
                '[]'
            ) AS lines
        FROM working_schedules ws
        LEFT JOIN schedule_lines sl ON sl.schedule_id = ws.id
        GROUP BY ws.id
        ORDER BY ws.name ASC;
    `;
    const { rows } = await query(sql);
    return rows;
};

export const findById = async (id) => {
    const sql = `
        SELECT
            ws.*,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', sl.id, 'day_of_week', sl.day_of_week,
                        'start_time', sl.start_time, 'end_time', sl.end_time,
                        'break_minutes', sl.break_minutes, 'is_active', sl.is_active
                    ) ORDER BY sl.day_of_week
                ) FILTER (WHERE sl.id IS NOT NULL),
                '[]'
            ) AS lines
        FROM working_schedules ws
        LEFT JOIN schedule_lines sl ON sl.schedule_id = ws.id
        WHERE ws.id = $1
        GROUP BY ws.id;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * Compute total_weekly_hours from lines array.
 * Each line: (end_time - start_time) in hours - break_minutes/60
 */
export const computeWeeklyHours = (lines) => {
    return lines.reduce((total, line) => {
        const [sh, sm] = line.start_time.split(':').map(Number);
        const [eh, em] = line.end_time.split(':').map(Number);
        const worked = (eh * 60 + em) - (sh * 60 + sm) - (line.break_minutes ?? 0);
        return total + (worked / 60);
    }, 0);
};

/**
 * Create schedule + lines in a single transaction.
 */
export const create = async (name, lines) => {
    return transaction(async (client) => {
        const totalHours = computeWeeklyHours(lines);
        const { rows: [schedule] } = await client.query(
            `INSERT INTO working_schedules (name, total_weekly_hours)
             VALUES ($1, $2) RETURNING *;`,
            [name, totalHours]
        );

        for (const line of lines) {
            await client.query(
                `INSERT INTO schedule_lines (schedule_id, day_of_week, start_time, end_time, break_minutes)
                 VALUES ($1, $2, $3, $4, $5);`,
                [schedule.id, line.day_of_week, line.start_time, line.end_time, line.break_minutes ?? 0]
            );
        }

        return schedule;
    });
};

/**
 * Update schedule name/status + replace all lines in a transaction.
 */
export const update = async (id, fields, lines) => {
    return transaction(async (client) => {
        // Rebuild lines if provided
        if (lines !== undefined) {
            await client.query(`DELETE FROM schedule_lines WHERE schedule_id = $1;`, [id]);
            const totalHours = computeWeeklyHours(lines);
            fields.total_weekly_hours = totalHours;

            for (const line of lines) {
                await client.query(
                    `INSERT INTO schedule_lines (schedule_id, day_of_week, start_time, end_time, break_minutes)
                     VALUES ($1, $2, $3, $4, $5);`,
                    [id, line.day_of_week, line.start_time, line.end_time, line.break_minutes ?? 0]
                );
            }
        }

        const allowedKeys = ['name', 'is_active', 'total_weekly_hours'];
        const setClauses = [];
        const values = [];
        let p = 1;
        for (const key of allowedKeys) {
            if (fields[key] !== undefined) {
                setClauses.push(`${key} = $${p++}`);
                values.push(fields[key]);
            }
        }

        if (setClauses.length === 0) {
            const { rows } = await client.query(`SELECT * FROM working_schedules WHERE id = $1;`, [id]);
            return rows[0] ?? null;
        }

        values.push(id);
        const { rows } = await client.query(
            `UPDATE working_schedules SET ${setClauses.join(', ')} WHERE id = $${p} RETURNING *;`,
            values
        );
        return rows[0] ?? null;
    });
};

export const remove = async (id) => {
    const sql = `DELETE FROM working_schedules WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

export const hasActiveContractReference = async (id) => {
    const sql = `SELECT 1 FROM contracts WHERE schedule_id = $1 AND status = 'active' LIMIT 1;`;
    const { rows } = await query(sql, [id]);
    return rows.length > 0;
};
