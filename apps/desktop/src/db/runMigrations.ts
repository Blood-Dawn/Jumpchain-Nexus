/*
MIT License

Copyright (c) 2025 Age-Of-Ages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import envPaths from "env-paths";
import initSqlJs from "sql.js";

const PRODUCT_NAME = "Jumpchain Nexus";
const DB_FILENAME = "jumpchain-nexus.db";

function resolveMigrationDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, "migrations");
}

async function loadMigrations(dir: string): Promise<string[]> {
  const entries = (await readdir(dir)) as string[];
  return entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .map((entry) => path.join(dir, entry));
}

async function readSqlFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return buffer.toString("utf8");
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => `${statement};`);
}

async function ensureConfigDir(): Promise<string> {
  const paths = envPaths(PRODUCT_NAME, { suffix: "" });
  const target = path.join(paths.config);
  if (!existsSync(target)) {
    await mkdir(target, { recursive: true });
  }
  return target;
}

async function loadDatabaseBinary(dbPath: string): Promise<Uint8Array | null> {
  if (!existsSync(dbPath)) {
    return null;
  }
  const buffer = await readFile(dbPath);
  return new Uint8Array(buffer);
}

async function saveDatabase(dbPath: string, database: any): Promise<void> {
  const binaryArray = database.export();
  await writeFile(dbPath, Buffer.from(binaryArray));
}

async function applyMigrations(): Promise<void> {
  const [SQL, configDir] = await Promise.all([initSqlJs(), ensureConfigDir()]);
  const dbPath = path.join(configDir, DB_FILENAME);
  const migrationsDir = resolveMigrationDir();
  const migrations = await loadMigrations(migrationsDir);
  const binary = await loadDatabaseBinary(dbPath);
  const db = binary ? new SQL.Database(binary) : new SQL.Database();

  for (const migration of migrations) {
    const rawSql = await readSqlFile(migration);
    const statements = splitStatements(rawSql);
    for (const statement of statements) {
      db.exec(statement);
    }
  }

  await saveDatabase(dbPath, db);
  console.log(`✅ Database ready at ${dbPath}`);
}

applyMigrations().catch((error) => {
  console.error("Failed to run migrations", error);
  process.exitCode = 1;
});
