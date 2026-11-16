import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function databasePath() {
  const filename = process.env.PERSONAL_DATABASE_FILE?.trim() || "giaphavn.sqlite";
  if (!/^[a-zA-Z0-9._-]+\.(?:sqlite|db)$/.test(filename)) {
    throw new Error("PERSONAL_DATABASE_FILE phải là một tên file .sqlite hoặc .db hợp lệ.");
  }
  return path.join(process.cwd(), ".data", filename);
}

function withDatabase<T>(operation: (database: DatabaseSync) => T) {
  const filename = databasePath();
  mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename, { timeout: 5_000 });
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS personal_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      PRAGMA user_version = 1;
    `);
    return operation(database);
  } finally {
    database.close();
  }
}

export function readPersonalState(key: string) {
  return withDatabase((database) => {
    const row = database.prepare("SELECT value FROM personal_state WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value;
  });
}

export function writePersonalState(key: string, value: string) {
  return withDatabase((database) => {
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`
        INSERT INTO personal_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `).run(key, value, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      try { database.exec("ROLLBACK"); } catch { /* Transaction was already closed. */ }
      throw error;
    }
  });
}
