import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import { replay, update, type TrendState } from "../lib/trend.ts";
import { dayNumber } from "../lib/time.ts";
import type { Units } from "../lib/body.ts";

export type Reading = { id: string; date: string; minute: number; kg: number; tags: string[]; note: string; createdAt: number };

export type Settings = {
  heightCm: number;
  units: Units;
  heightImperial: boolean;
  targetKg: number | null;
  deadline: string | null; // YYYY-MM-DD
  paceLimit: number; // кг/неделю — задаёт пользователь
  reminders: boolean;
  reminderHour: number;
  haptics: boolean;
  onboarded: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  heightCm: 170,
  units: "kg",
  heightImperial: false,
  targetKg: null,
  deadline: null,
  paceLimit: 0.5,
  reminders: false,
  reminderHour: 8,
  haptics: true,
  onboarded: false,
};

// Время взвешивания в днях: номер дня + доля суток — так фильтр видит и
// утренние, и вечерние взвешивания одного дня в правильном порядке.
export function dayOf(r: { date: string; minute: number }): number {
  return dayNumber(r.date) + r.minute / 1440;
}

type Row = Record<string, unknown>;

function toReading(r: Row): Reading {
  return {
    id: r.id as string,
    date: r.date as string,
    minute: r.minute as number,
    kg: r.kg as number,
    tags: JSON.parse(r.tags as string),
    note: r.note as string,
    createdAt: r.created_at as number,
  };
}

export async function loadAll() {
  const db = await getDb();
  const readings = (await db.getAllAsync<Row>("SELECT * FROM readings ORDER BY date, minute")).map(toReading);
  const srows = await db.getAllAsync<{ key: string; value: string }>("SELECT * FROM settings");
  const settings: Settings = { ...DEFAULT_SETTINGS };
  let model: TrendState | null = null;
  for (const r of srows) {
    if (r.key === "model") model = JSON.parse(r.value);
    else if (r.key in settings) (settings as Record<string, unknown>)[r.key] = JSON.parse(r.value);
  }
  return { readings, settings, model };
}

async function saveModel(m: TrendState | null): Promise<void> {
  const db = await getDb();
  if (m) await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('model', ?)", [JSON.stringify(m)]);
  else await db.runAsync("DELETE FROM settings WHERE key = 'model'");
}

export async function rebuildModel(): Promise<void> {
  const db = await getDb();
  const rows = (await db.getAllAsync<Row>("SELECT * FROM readings")).map(toReading);
  await saveModel(replay(rows.map((r) => ({ id: r.id, day: dayOf(r), kg: r.kg }))).state);
}

export async function addReading(input: { date: string; minute: number; kg: number; tags: string[]; note: string }): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.runAsync("INSERT INTO readings (id, date, minute, kg, tags, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    id,
    input.date,
    input.minute,
    input.kg,
    JSON.stringify(input.tags),
    input.note,
    Date.now(),
  ]);
  // Новое взвешивание после последнего учтённого — одно обновление фильтра
  // (накапливаемое состояние); задним числом — честная пересборка.
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'model'");
  const prev: TrendState | null = row ? JSON.parse(row.value) : null;
  const day = dayOf(input);
  if (!prev || day >= prev.day) await saveModel(update(prev, { day, kg: input.kg }).state);
  else await rebuildModel();
  return id;
}

export async function updateReading(id: string, patch: { kg?: number; tags?: string[]; note?: string; minute?: number }): Promise<void> {
  const db = await getDb();
  if (patch.kg !== undefined) await db.runAsync("UPDATE readings SET kg = ? WHERE id = ?", [patch.kg, id]);
  if (patch.minute !== undefined) await db.runAsync("UPDATE readings SET minute = ? WHERE id = ?", [patch.minute, id]);
  if (patch.tags !== undefined) await db.runAsync("UPDATE readings SET tags = ? WHERE id = ?", [JSON.stringify(patch.tags), id]);
  if (patch.note !== undefined) await db.runAsync("UPDATE readings SET note = ? WHERE id = ?", [patch.note, id]);
  if (patch.kg !== undefined || patch.minute !== undefined) await rebuildModel();
}

export async function deleteReading(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM readings WHERE id = ?", [id]);
  await rebuildModel();
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
}

export async function resetAll(): Promise<void> {
  const db = await getDb();
  await db.execAsync("DELETE FROM readings; DELETE FROM settings;");
}
