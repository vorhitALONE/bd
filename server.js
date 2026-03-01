// server.js
"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

// ----- config -----
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

// Если будет отдельный фронт — укажи CLIENT_URL в переменных Timeweb
const CLIENT_URL = process.env.CLIENT_URL || "";

// ----- middleware -----
app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: CLIENT_URL ? [CLIENT_URL] : true,
    credentials: true,
  })
);

// ----- health / status -----
app.get("/", (req, res) => {
  res.type("text/plain").send("OK");
});

app.get("/api/test", (req, res) => {
  res.json({
    ok: true,
    service: "bd-backend",
    time: new Date().toISOString(),
  });
});

// ----- simple in-memory storage (demo) -----
let items = [];
let nextId = 1;

// Create
app.post("/api/items", (req, res) => {
  const { value } = req.body || {};
  if (typeof value !== "string" || !value.trim()) {
    return res.status(400).json({ ok: false, error: "value (string) is required" });
  }

  const item = { id: nextId++, value: value.trim(), created_at: new Date().toISOString() };
  items.unshift(item);
  return res.json({ ok: true, item });
});

// Read list
app.get("/api/items", (req, res) => {
  res.json({ ok: true, items });
});

// Read one
app.get("/api/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const item = items.find((x) => x.id === id);
  if (!item) return res.status(404).json({ ok: false, error: "not found" });
  res.json({ ok: true, item });
});

// Delete
app.delete("/api/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const before = items.length;
  items = items.filter((x) => x.id !== id);
  if (items.length === before) return res.status(404).json({ ok: false, error: "not found" });
  res.json({ ok: true });
});

// ----- errors -----
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Route not found" });
});

// ----- start -----
app.listen(PORT, HOST, () => {
  console.log(`Server started: http://${HOST}:${PORT}`);
});