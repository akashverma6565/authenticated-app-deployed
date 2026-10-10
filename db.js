const { Pool } = require("pg");

// Production: real Postgres via DATABASE_URL.
// Local dev / tests without DATABASE_URL: in-memory Postgres (data resets on restart).
function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    });
  }
  const { newDb } = require("pg-mem");
  const { Pool: MemPool } = newDb().adapters.createPg();
  return new MemPool();
}

async function initSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
    )`);
}

module.exports = { createPool, initSchema };
