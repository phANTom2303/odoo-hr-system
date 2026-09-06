import pg from 'pg';

const { Pool, types } = pg;

// Parse TIMESTAMP WITHOUT TIME ZONE (OID 1114) as UTC ISO strings
// instead of letting the pg driver apply local timezone offset.
// Without this, NOW() stored in the DB (UTC) gets misread as local time.
types.setTypeParser(1114, (val) => new Date(val + 'Z').toISOString());

// Parse TIMESTAMPTZ (OID 1184) consistently as well
types.setTypeParser(1184, (val) => new Date(val).toISOString());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Standard query wrapper with execution time logging
export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  return res;
};

// Transaction helper to ensure atomic operations
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export { pool };
