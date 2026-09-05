# API Blueprint — 4-Layer Architecture

> **Purpose:** Attach this document to any AI agent's system prompt so it can scaffold new REST APIs that are consistent with this codebase's patterns.

---

## 1. Architecture Overview

Every API resource follows a strict **4-layer** flow. Data moves **downward** through the layers; errors propagate **upward** via a global error handler.

```
Request ──▸ Routes ──▸ Controller ──▸ Service ──▸ Repository ──▸ PostgreSQL
                                        │
                                        ▼
                                      Redis (optional cache)
```

| Layer | Directory | Responsibility |
|---|---|---|
| **Routes** | `src/routes/<resource>.routes.js` | HTTP verbs, paths, Zod validation schemas, middleware wiring |
| **Controller** | `src/controllers/<resource>.controller.js` | Extract data from `req`, delegate to service, return standardized JSON |
| **Service** | `src/services/<resource>.service.js` | Business logic, cache orchestration (Redis cache-aside), throw domain errors |
| **Repository** | `src/repositories/<resource>.repo.js` | Raw parameterized SQL via `db.query`, returns plain row objects or `null` |

### Hard Rules

- **No layer may skip another.** Routes → Controller → Service → Repository.
- **Only the Service layer** throws domain errors (`NotFoundError`, etc.).
- **Only the Repository layer** touches SQL / the database.
- **Only the Service layer** touches Redis.
- **Controllers never import repositories directly.**
- **Routes never contain business logic.**

---

## 2. Project Structure & Import Aliases

```
server/
├── package.json            # "type": "module", subpath imports below
└── src/
    ├── app.js              # Express bootstrap, global middlewares, route mounts, error handler
    ├── config/             # db.js, redis.js, logger.js, initDb.js
    ├── controllers/        # HTTP interface layer
    ├── lib/                # Shared utilities (errors.js, common.js, asyncHandler.js)
    ├── middlewares/         # Express middlewares (validate.js, auth, etc.)
    ├── repositories/       # Database abstraction layer
    ├── routes/             # Route definitions + Zod schemas
    ├── services/           # Business logic + caching layer
    └── utils/              # General-purpose helpers
```

**Subpath imports** (defined in `package.json` `"imports"` field):

```jsonc
{
  "#config/*":       "./src/config/*",
  "#lib/*":          "./src/lib/*",
  "#middlewares/*":  "./src/middlewares/*",
  "#utils/*":        "./src/utils/*",
  "#repositories/*": "./src/repositories/*",
  "#controllers/*":  "./src/controllers/*",
  "#services/*":     "./src/services/*",
  "#routes/*":       "./src/routes/*"
}
```

Always use these `#`-prefixed aliases in import statements — never relative paths across layers.

---

## 3. Shared Infrastructure (DO NOT RECREATE)

These modules already exist and must be **imported, not duplicated**.

### 3a. `#lib/common.js` — Response Codes

```js
export const RESPONSE_CODES = Object.freeze({
  SUCCESS_CODE:                200,
  CREATED_CODE:                201,
  RESOURCE_MOVED_PERMANENTLY_CODE: 301,
  REDIRECTION_CODE:            302,
  BAD_REQUEST_CODE:            400,
  UNAUTHORIZED_ERROR_CODE:     401,
  FORBIDDEN_ERROR_CODE:        403,
  NOT_FOUND_ERROR_CODE:        404,
  ACCESS_ERROR_CODE:           405,
  CONFLICT_ERROR_CODE:         409,
  UNPROCESSABLE_ERROR_CODE:    422,
  RATE_LIMIT_ERROR_CODE:       429,
  INTERNAL_SERVER_ERROR_CODE:  500,
});
```

### 3b. `#lib/errors.js` — Error Hierarchy

All errors extend `AppError` and are **operational** (caught by the global error handler):

| Class | Status | Default Message |
|---|---|---|
| `BadRequestError` | 400 | Bad Request |
| `UnauthorizedError` | 401 | Invalid Credentials Found |
| `ForbiddenError` | 403 | Access Forbidden |
| `NotFoundError` | 404 | Resource Not Found |
| `MethodNotAllowedError` | 405 | Method Not Allowed |
| `ConflictError` | 409 | Resource Conflict Occurred |
| `UnprocessableError` | 422 | Validation Failed |
| `RateLimitError` | 429 | Too many requests, please try again later |
| `InternalServerError` | 500 | Internal Server Error (`isOperational = false`) |

### 3c. `#lib/asyncHandler.js` — Async Wrapper

```js
const asyncHandler = (fn) => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
};
export default asyncHandler;
```

Every controller handler **must** be wrapped with `asyncHandler`.

### 3d. `#middlewares/validate.js` — Zod Validation Middleware

```js
import { validate } from '#middlewares/validate.js';
// Usage in routes:
router.post('/', validate({ body: createSchema }), controller.create);
router.get('/:id', validate({ params: idParamSchema }), controller.getById);
router.put('/:id', validate({ params: idParamSchema, body: updateSchema }), controller.update);
```

Accepts an object with optional keys `body`, `params`, `query` — each mapping to a Zod schema. On failure it throws `BadRequestError` with structured details. On success it replaces `req[source]` with the parsed (coerced/defaulted) values.

### 3e. `#config/db.js` — Database Query Helper

```js
import { query } from '#config/db.js';
const { rows } = await query('SELECT * FROM table WHERE id = $1', [id]);
```

Uses parameterized queries with `$1, $2, ...` placeholders (PostgreSQL).

### 3f. `#config/redis.js` — Redis Client

```js
import { getRedisClient } from '#config/redis.js';
const redis = getRedisClient();
```

### 3g. `#config/logger.js` — Pino Logger

```js
import { logger } from '#config/logger.js';
logger.info('message');
logger.warn({ err, key }, 'Redis GET failed');
```

---

## 4. Layer Templates

Below are the canonical templates for each layer. Replace `<Resource>` with the PascalCase entity name (e.g., `Employee`, `Department`), `<resource>` with the lowercase singular (e.g., `employee`), and `<resources>` with the lowercase plural (e.g., `employees`).

---

### 4a. Repository — `src/repositories/<resource>.repo.js`

```js
/**
 * @fileoverview <Resource> Repository — Pure database abstraction layer.
 * Executes raw, parameterized SQL via the centralized `db.query` helper.
 * Returns plain row objects (or null). Never touches HTTP or Redis.
 */

import { query } from '#config/db.js';

/**
 * Insert a new <resource> row.
 * @returns {Promise<object>} The created row.
 */
export const create = async (/* individual fields or destructured object */) => {
    const sql = `
        INSERT INTO <resources> (col1, col2)
        VALUES ($1, $2)
        RETURNING *;
    `;
    const { rows } = await query(sql, [/* values */]);
    return rows[0];
};

/**
 * Fetch all <resources>, newest first.
 * @returns {Promise<object[]>}
 */
export const findAll = async () => {
    const sql = `SELECT * FROM <resources> ORDER BY created_at DESC;`;
    const { rows } = await query(sql);
    return rows;
};

/**
 * Fetch a single <resource> by its UUID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export const findById = async (id) => {
    const sql = `SELECT * FROM <resources> WHERE id = $1;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};

/**
 * Dynamically update only the provided fields.
 * @param {string} id
 * @param {object} fields - Partial object with updatable keys
 * @returns {Promise<object|null>} The updated row, or null if not found.
 */
export const update = async (id, fields) => {
    const allowedKeys = ['col1', 'col2' /* ... */];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const key of allowedKeys) {
        if (fields[key] !== undefined) {
            setClauses.push(`${key} = $${paramIndex}`);
            values.push(fields[key]);
            paramIndex++;
        }
    }

    if (setClauses.length === 0) return findById(id);

    values.push(id);

    const sql = `
        UPDATE <resources>
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *;
    `;

    const { rows } = await query(sql, values);
    return rows[0] ?? null;
};

/**
 * Delete a <resource> by UUID.
 * @param {string} id
 * @returns {Promise<object|null>} The deleted row's id, or null if not found.
 */
export const remove = async (id) => {
    const sql = `DELETE FROM <resources> WHERE id = $1 RETURNING id;`;
    const { rows } = await query(sql, [id]);
    return rows[0] ?? null;
};
```

**Key patterns:**
- All IDs are UUIDs (generated by PostgreSQL).
- `RETURNING *` on INSERT/UPDATE; `RETURNING id` on DELETE.
- Dynamic `SET` clause construction for partial updates with an `allowedKeys` whitelist.
- Return `null` when a row is not found — let the Service decide whether that's an error.

---

### 4b. Service — `src/services/<resource>.service.js`

```js
/**
 * @fileoverview <Resource> Service — Core business logic & Redis cache orchestrator.
 * Implements Cache-Aside pattern: read-through on GETs, invalidate on mutations.
 */

import * as <resource>Repo from '#repositories/<resource>.repo.js';
import { getRedisClient } from '#config/redis.js';
import { logger } from '#config/logger.js';
import { NotFoundError } from '#lib/errors.js';

// ── Cache Key Conventions ───────────────────────────────────────────
const CACHE_KEYS = {
    single: (id) => `<resource>:${id}`,
    list: '<resources>:all',
};

const CACHE_TTL = 3600; // seconds

// ── Safe Redis Helpers ──────────────────────────────────────────────
// Never let a cache failure crash a request — degrade to DB-only.

const safeRedisGet = async (key) => {
    try {
        const redis = getRedisClient();
        return await redis.get(key);
    } catch (err) {
        logger.warn({ err, key }, 'Redis GET failed — falling back to DB');
        return null;
    }
};

const safeRedisSet = async (key, value, ttl = CACHE_TTL) => {
    try {
        const redis = getRedisClient();
        await redis.set(key, JSON.stringify(value), { EX: ttl });
    } catch (err) {
        logger.warn({ err, key }, 'Redis SET failed — skipping cache write');
    }
};

const safeRedisDel = async (...keys) => {
    try {
        const redis = getRedisClient();
        await redis.del(keys);
    } catch (err) {
        logger.warn({ err, keys }, 'Redis DEL failed — stale cache possible');
    }
};

// ── Service Methods ─────────────────────────────────────────────────

export const getAll = async () => {
    const cached = await safeRedisGet(CACHE_KEYS.list);
    if (cached) {
        logger.info('Cache HIT — <resources>:all');
        return JSON.parse(cached);
    }

    logger.info('Cache MISS — <resources>:all → querying DB');
    const rows = await <resource>Repo.findAll();
    await safeRedisSet(CACHE_KEYS.list, rows);
    return rows;
};

export const getById = async (id) => {
    const cacheKey = CACHE_KEYS.single(id);
    const cached = await safeRedisGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const row = await <resource>Repo.findById(id);
    if (!row) throw new NotFoundError(`<Resource> with id "${id}" not found`);

    await safeRedisSet(cacheKey, row);
    return row;
};

export const create = async (data) => {
    const row = await <resource>Repo.create(/* destructured data */);
    await safeRedisDel(CACHE_KEYS.list);
    return row;
};

export const update = async (id, fields) => {
    const updated = await <resource>Repo.update(id, fields);
    if (!updated) throw new NotFoundError(`<Resource> with id "${id}" not found`);

    await safeRedisDel(CACHE_KEYS.single(id), CACHE_KEYS.list);
    return updated;
};

export const remove = async (id) => {
    const deleted = await <resource>Repo.remove(id);
    if (!deleted) throw new NotFoundError(`<Resource> with id "${id}" not found`);

    await safeRedisDel(CACHE_KEYS.single(id), CACHE_KEYS.list);
};
```

**Key patterns:**
- **Cache-Aside:** Read from cache first → fall back to DB → populate cache. Invalidate on every mutation.
- **Safe Redis wrappers:** All Redis calls are wrapped in try/catch — the app degrades gracefully if Redis is unavailable.
- **Domain errors:** Only this layer throws `NotFoundError`, `ConflictError`, etc.
- Cache keys follow `<resource>:<id>` for singles, `<resources>:all` for lists.

---

### 4c. Controller — `src/controllers/<resource>.controller.js`

```js
/**
 * @fileoverview <Resource> Controller — HTTP interface layer.
 * Extracts data from req, delegates to the service, returns standardized responses.
 * Every handler is wrapped in asyncHandler to forward errors to the global error handler.
 */

import asyncHandler from '#lib/asyncHandler.js';
import * as <resource>Service from '#services/<resource>.service.js';
import { RESPONSE_CODES } from '#lib/common.js';

/** GET /api/<resources> */
export const getAll = asyncHandler(async (req, res) => {
    const items = await <resource>Service.getAll();

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        count: items.length,
        data: items,
    });
});

/** GET /api/<resources>/:id */
export const getById = asyncHandler(async (req, res) => {
    const item = await <resource>Service.getById(req.params.id);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: item,
    });
});

/** POST /api/<resources> */
export const create = asyncHandler(async (req, res) => {
    const item = await <resource>Service.create(req.body);

    res.status(RESPONSE_CODES.CREATED_CODE).json({
        success: true,
        data: item,
    });
});

/** PUT/PATCH /api/<resources>/:id */
export const update = asyncHandler(async (req, res) => {
    const item = await <resource>Service.update(req.params.id, req.body);

    res.status(RESPONSE_CODES.SUCCESS_CODE).json({
        success: true,
        data: item,
    });
});

/** DELETE /api/<resources>/:id */
export const remove = asyncHandler(async (req, res) => {
    await <resource>Service.remove(req.params.id);

    res.status(204).end();
});
```

**Key patterns:**
- **Every handler** is wrapped with `asyncHandler(async (req, res) => { ... })`.
- Response envelope is always `{ success: true, data: ... }`.
  - List endpoints add a `count` field.
  - Delete returns `204 No Content` with no body.
- Uses `RESPONSE_CODES` constants — never raw status numbers (except `204`).
- Controllers are **thin** — no business logic, no DB calls, no caching.

---

### 4d. Routes — `src/routes/<resource>.routes.js`

```js
/**
 * @fileoverview <Resource> Routes — HTTP verbs, paths, validation, and controller wiring.
 * Zod schemas are co-located here with the routes they guard.
 */

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '#middlewares/validate.js';
import * as <resource>Controller from '#controllers/<resource>.controller.js';

const router = Router();

// ── Zod Schemas ─────────────────────────────────────────────────────

/** Validates :id param is a valid UUID. */
const idParamSchema = z.object({
    id: z.string().uuid({ message: 'id must be a valid UUID' }),
});

/** POST — full create payload. */
const createSchema = z.object({
    // Define required & optional fields with Zod constraints
    // e.g. name: z.string().min(1, 'name is required').max(255),
});

/** PUT — full replacement (all required fields present). */
const updateSchema = z.object({
    // Mirror create schema — fields required for full replacement
});

/** PATCH — partial update (at least one field must be present). */
const patchSchema = z
    .object({
        // All fields optional
    })
    .refine(
        (data) => Object.values(data).some((v) => v !== undefined),
        { message: 'At least one field must be provided' }
    );

// ── Route Definitions ───────────────────────────────────────────────

router.get('/', <resource>Controller.getAll);

router.get('/:id', validate({ params: idParamSchema }), <resource>Controller.getById);

router.post('/', validate({ body: createSchema }), <resource>Controller.create);

router.put(
    '/:id',
    validate({ params: idParamSchema, body: updateSchema }),
    <resource>Controller.update
);

router.patch(
    '/:id',
    validate({ params: idParamSchema, body: patchSchema }),
    <resource>Controller.update
);

router.delete('/:id', validate({ params: idParamSchema }), <resource>Controller.remove);

export default router;
```

**Key patterns:**
- Zod schemas are **co-located** in the routes file, not in a separate schemas directory.
- `idParamSchema` is reused for all routes with `:id`.
- PUT gets a full replacement schema; PATCH gets a partial schema with a `.refine()` ensuring at least one field.
- `validate()` middleware is applied **before** the controller handler.

---

## 5. Wiring — Registering a New Router in `app.js`

After creating all 4 layer files, mount the router in `src/app.js`:

```js
import <resource>Router from '#routes/<resource>.routes.js';

// ── Route Mounts ────────────────────────────────────────────────────
app.use('/api/<resources>', <resource>Router);
```

This is the **only** change needed in `app.js`.

---

## 6. Global Error Handler (Already Exists)

The error handler in `app.js` catches everything:

- **Operational errors** (`AppError` subclasses with `isOperational = true`): Responds with the error's `status` and `message`.
- **Unexpected errors**: Logs the full stack and returns a generic `500`.

```js
// Response shape for errors:
{ "success": false, "error": "<message>" }
```

You do **not** need to add try/catch in controllers — `asyncHandler` + the global handler take care of it.

---

## 7. Checklist for Adding a New Resource

When asked to create a new API for a resource (e.g., `Employee`):

1. **[ ] Repository** — `src/repositories/employee.repo.js`
   - `create`, `findAll`, `findById`, `update`, `remove`
   - Use parameterized SQL with `$1, $2, ...`
   - Dynamic `SET` clause for partial updates

2. **[ ] Service** — `src/services/employee.service.js`
   - Import the repository, Redis helpers, and error classes
   - Implement cache-aside (GET → cache check → DB fallback → cache set)
   - Invalidate caches on create/update/delete
   - Throw `NotFoundError` when rows are `null`

3. **[ ] Controller** — `src/controllers/employee.controller.js`
   - Import the service and `asyncHandler`
   - Thin handlers: extract from `req`, call service, return JSON envelope
   - Wrap every handler with `asyncHandler`

4. **[ ] Routes** — `src/routes/employee.routes.js`
   - Define Zod schemas (create, update, patch, idParam)
   - Wire `validate()` middleware to routes
   - Map HTTP verbs to controller functions

5. **[ ] Mount** — Add `app.use('/api/employees', employeeRouter)` in `src/app.js`

6. **[ ] Database** — Ensure the corresponding table exists (migration or init script)

---

## 8. Tech Stack Reference

| Concern | Package |
|---|---|
| Runtime | Node.js (ESM — `"type": "module"`) |
| Framework | Express 5 |
| Database | PostgreSQL via `pg` |
| Caching | Redis via `redis` |
| Validation | Zod 4 |
| Logging | Pino + pino-pretty |
| Security | Helmet, CORS |
| Auth (available) | jsonwebtoken |
| HTTP Client | Axios |
