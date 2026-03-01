// server.js
const express = require("express");
const session = require("express-session");
const FileStoreFactory = require("session-file-store")(session);
const helmet = require("helmet");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const db = require("./db");
const { requireAuth } = require("./auth");

const app = express();

// --- config ---
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const SESSION_PATH = process.env.SESSION_PATH || "/tmp/sessions";

const CLIENT_URL = process.env.CLIENT_URL || ""; // optional
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

// --- middleware ---
app.use(helmet());
app.use(express.json({ limit: "1mb" }));

// CORS: если фронт на другом домене — укажи CLIENT_URL
app.use(
  cors({
    origin: CLIENT_URL ? [CLIENT_URL] : true,
    credentials: true,
  })
);

app.set("trust proxy", 1);

app.use(
  session({
    store: new FileStoreFactory({ path: SESSION_PATH }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: CLIENT_URL ? "none" : "lax",
      secure: CLIENT_URL ? true : false, // если работаешь через https и отдельный домен
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// --- helpers ---
function ensureAdminUser() {
  const existing = db
    .prepare("SELECT id, username FROM users WHERE username = ?")
    .get(ADMIN_USERNAME);

  if (existing) return;

  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(ADMIN_USERNAME, hash);

  console.log(`[init] Admin created: ${ADMIN_USERNAME}`);
}

ensureAdminUser();

// --- healthcheck ---
app.get("/api/test", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// --- auth routes ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "username/password required" });
  }

  const user = db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username);

  if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

  req.session.user = { id: user.id, username: user.username };
  return res.json({ ok: true, user: { id: user.id, username: user.username } });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session?.user) return res.json({ ok: true, user: null });
  res.json({ ok: true, user: req.session.user });
});

// --- numbers routes ---
app.post("/api/numbers", requireAuth, (req, res) => {
  const { value } = req.body || {};
  if (!value || typeof value !== "string") {
    return res.status(400).json({ ok: false, error: "value(string) required" });
  }

  const r = db.prepare("INSERT INTO numbers (value) VALUES (?)").run(value);
  return res.json({ ok: true, id: r.lastInsertRowid });
});

app.get("/api/numbers", requireAuth, (req, res) => {
  const rows = db
    .prepare("SELECT id, value, created_at FROM numbers ORDER BY id DESC LIMIT 200")
    .all();
  res.json({ ok: true, items: rows });
});

app.delete("/api/numbers/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad id" });

  db.prepare("DELETE FROM numbers WHERE id = ?").run(id);
  res.json({ ok: true });
});

// --- start ---
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
