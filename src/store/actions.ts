import * as repo from "../data/repo";
import { useApp } from "./appStore";

// Каждое действие пишет в базу и перечитывает стор (с пересчётом анализа).
async function run<T>(fn: () => Promise<T>): Promise<T> {
  const r = await fn();
  await useApp.getState().refresh();
  return r;
}

export const actions = {
  add: (input: Parameters<typeof repo.addReading>[0]) => run(() => repo.addReading(input)),
  update: (id: string, patch: Parameters<typeof repo.updateReading>[1]) => run(() => repo.updateReading(id, patch)),
  remove: (id: string) => run(() => repo.deleteReading(id)),
  setSetting: <K extends keyof repo.Settings>(key: K, value: repo.Settings[K]) => run(() => repo.setSetting(key, value)),
  resetAll: () => run(() => repo.resetAll()),
};
