import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { env } from "@/lib/env";

declare global {
  var __industrialAttachmentDb: Database.Database | undefined;
}

function ensurePath(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function runMigrationsInternal(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const applied = new Set(
    (
      database.prepare("SELECT id FROM _migrations ORDER BY id ASC").all() as {
        id: string;
      }[]
    ).map((row) => row.id),
  );

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const insertMigration = database.prepare(
    "INSERT INTO _migrations (id, applied_at) VALUES (?, datetime('now'))",
  );

  for (const fileName of migrationFiles) {
    if (applied.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, fileName), "utf8");
    const tx = database.transaction(() => {
      database.exec(sql);
      insertMigration.run(fileName);
    });
    tx();
  }
}

export function getDb(): Database.Database {
  if (global.__industrialAttachmentDb) {
    return global.__industrialAttachmentDb;
  }

  ensurePath(env.DATABASE_PATH);
  const database = new Database(env.DATABASE_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  runMigrationsInternal(database);

  global.__industrialAttachmentDb = database;
  return database;
}

export function runMigrations(): void {
  const database = getDb();
  runMigrationsInternal(database);
}
