/**
 * @fileoverview Zod-powered validation middleware factory.
 *
 * Usage:
 *   import { validate } from '#middlewares/validate.js';
 *   router.post('/', validate({ body: createSchema }), controller);
 *   router.get('/:id', validate({ params: idSchema }), controller);
 *
 * Accepts an object with optional keys: body, params, query.
 * Each key maps to a Zod schema. On validation failure, responds
 * with 400 and structured error details.
 */

import { z } from 'zod';
import { BadRequestError } from '#lib/errors.js';

/**
 * Returns an Express middleware that validates selected parts of the request.
 * @param {{ body?: z.ZodTypeAny, params?: z.ZodTypeAny, query?: z.ZodTypeAny }} schemas
 * @returns {import('express').RequestHandler}
 */
export const validate = (schemas) => (req, _res, next) => {
    const errors = [];

    for (const [source, schema] of Object.entries(schemas)) {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            for (const issue of result.error.issues) {
                errors.push({
                    source,
                    path: issue.path.join('.'),
                    message: issue.message,
                });
            }
        } else {
            // Replace req[source] with the parsed (coerced / defaulted) values
            req[source] = result.data;
        }
    }

    if (errors.length > 0) {
        throw new BadRequestError(
            `Validation failed: ${errors.map((e) => `[${e.source}.${e.path}] ${e.message}`).join('; ')}`
        );
    }

    next();
};
