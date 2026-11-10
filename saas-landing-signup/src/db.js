const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbFile = path.resolve(process.env.DB_FILE || "./data/app.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    company TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    verification_token_hash TEXT,
    verification_expires_at INTEGER,
    created_at INTEGER NOT NULL
  );
`);

module.exports = db;
