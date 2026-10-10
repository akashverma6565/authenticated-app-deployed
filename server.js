const session = require("express-session");
const { createPool, initSchema } = require("./db");
const { createApp } = require("./app");

(async () => {
  const production = process.env.NODE_ENV === "production";
  const secret = process.env.SECRET_KEY;
  if (production && !secret) throw new Error("SECRET_KEY must be set in production");

  const pool = createPool();
  await initSchema(pool);

  // Persist sessions in Postgres when we have a real database; otherwise in-memory (dev only).
  let store;
  if (process.env.DATABASE_URL) {
    const PgStore = require("connect-pg-simple")(session);
    store = new PgStore({ pool, createTableIfMissing: true });
  }

  const app = createApp({ pool, store, secret: secret || "dev-only-change-me", production });
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`TaskVault running on http://localhost:${port}`));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
