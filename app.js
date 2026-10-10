const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const views = require("./views");

const BCRYPT_COST = 12;
// Used so a login for an unknown email takes about as long as a real one.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

function createApp({ pool, store, secret, production = false }) {
  const app = express();
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1); // behind the host's HTTPS proxy

  app.use(express.urlencoded({ extended: false, limit: "10kb" }));
  app.use(
    session({
      store,
      secret,
      name: "sid",
      resave: false,
      saveUninitialized: true,
      cookie: { httpOnly: true, sameSite: "lax", secure: production, maxAge: 1000 * 60 * 60 * 24 * 7 },
    })
  );

  // CSRF: one random token per session, required on every POST.
  app.use((req, res, next) => {
    if (!req.session.csrf) req.session.csrf = crypto.randomBytes(32).toString("hex");
    if (req.method === "POST") {
      const sent = Buffer.from(String(req.body.csrf || ""));
      const real = Buffer.from(req.session.csrf);
      if (sent.length !== real.length || !crypto.timingSafeEqual(sent, real)) {
        return res.status(403).send("Invalid CSRF token");
      }
    }
    next();
  });

  const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  const requireAuth = (req, res, next) => (req.session.userId ? next() : res.redirect("/login"));

  const startSession = (req, userId) =>
    new Promise((resolve, reject) =>
      req.session.regenerate((err) => {
        if (err) return reject(err);
        req.session.userId = userId; // new session id on login prevents session fixation
        req.session.csrf = crypto.randomBytes(32).toString("hex");
        resolve();
      })
    );

  app.get("/", (req, res) => res.redirect(req.session.userId ? "/tasks" : "/login"));

  app.get("/register", (req, res) => res.send(views.registerPage(req.session.csrf)));

  app.post(
    "/register",
    wrap(async (req, res) => {
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      if (!email.includes("@") || email.length > 255 || password.length < 8 || password.length > 72) {
        return res.status(400).send(views.registerPage(req.session.csrf, "Enter a valid email and a password of 8-72 characters."));
      }
      const hash = await bcrypt.hash(password, BCRYPT_COST);
      try {
        const { rows } = await pool.query(
          "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
          [email, hash]
        );
        await startSession(req, rows[0].id);
        res.redirect("/tasks");
      } catch (err) {
        if (err.code === "23505") {
          return res.status(409).send(views.registerPage(req.session.csrf, "That email is already registered."));
        }
        throw err;
      }
    })
  );

  app.get("/login", (req, res) => res.send(views.loginPage(req.session.csrf)));

  app.post(
    "/login",
    wrap(async (req, res) => {
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const { rows } = await pool.query("SELECT id, password_hash FROM users WHERE email = $1", [email]);
      const user = rows[0];
      const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
      if (!user || !ok) {
        return res.status(401).send(views.loginPage(req.session.csrf, "Invalid email or password."));
      }
      await startSession(req, user.id);
      res.redirect("/tasks");
    })
  );

  app.post("/logout", (req, res, next) =>
    req.session.destroy((err) => (err ? next(err) : res.redirect("/login")))
  );

  app.get(
    "/tasks",
    requireAuth,
    wrap(async (req, res) => {
      const { rows: u } = await pool.query("SELECT email FROM users WHERE id = $1", [req.session.userId]);
      // DATA SCOPING: every query is filtered by the signed-in user's id.
      const { rows: tasks } = await pool.query(
        "SELECT id, title, done FROM tasks WHERE user_id = $1 ORDER BY id DESC",
        [req.session.userId]
      );
      res.send(views.tasksPage(req.session.csrf, u[0].email, tasks));
    })
  );

  app.post(
    "/tasks",
    requireAuth,
    wrap(async (req, res) => {
      const title = String(req.body.title || "").trim().slice(0, 200);
      if (title) await pool.query("INSERT INTO tasks (title, user_id) VALUES ($1, $2)", [title, req.session.userId]);
      res.redirect("/tasks");
    })
  );

  // The user_id condition lives in the SQL itself, so another user's task id matches 0 rows -> 404.
  // (404 rather than 403 so ids can't be probed.)
  app.post(
    "/tasks/:id/toggle",
    requireAuth,
    wrap(async (req, res) => {
      const r = await pool.query(
        "UPDATE tasks SET done = NOT done WHERE id = $1 AND user_id = $2",
        [Number(req.params.id) || 0, req.session.userId]
      );
      if (r.rowCount === 0) return res.sendStatus(404);
      res.redirect("/tasks");
    })
  );

  app.post(
    "/tasks/:id/delete",
    requireAuth,
    wrap(async (req, res) => {
      const r = await pool.query("DELETE FROM tasks WHERE id = $1 AND user_id = $2", [
        Number(req.params.id) || 0,
        req.session.userId,
      ]);
      if (r.rowCount === 0) return res.sendStatus(404);
      res.redirect("/tasks");
    })
  );

  app.get("/healthz", (req, res) => res.send("ok"));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send("Something went wrong.");
  });

  return app;
}

module.exports = { createApp };
