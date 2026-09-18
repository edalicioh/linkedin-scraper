const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { applyMigrations } = require('./migrations');

const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'storage', 'jobs.db');

function createDatabase(dbPath = DEFAULT_DB_PATH) {
  const resolvedPath = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  applyMigrations(db);

  return db;
}

module.exports = {
  DEFAULT_DB_PATH,
  createDatabase
};
