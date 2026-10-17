import type { SQLiteDatabase } from "expo-sqlite";

// Каждая миграция — одна ступень схемы. Не редактируй уже выпущенную миграцию.
// Вес хранится в килограммах всегда; единицы — только отображение.
// settings.model — НАКОПЛЕННОЕ состояние фильтра тренда (JSON TrendState),
// обновляется на каждом новом взвешивании; при правке/удалении — пересборка.
const migrations: string[] = [
  `
  CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    minute INTEGER NOT NULL,
    kg REAL NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS readings_date ON readings(date);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;
  for (let i = currentVersion; i < migrations.length; i++) {
    await db.execAsync(migrations[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}
