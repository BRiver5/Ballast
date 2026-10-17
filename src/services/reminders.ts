// Ежедневное напоминание взвеситься — одно, в выбранный час, только если
// сегодня ещё не было взвешивания; разрешение — только по явному включению.
// В Expo Go модуль не грузится (см. notifications.ts шаблона).

import Constants, { ExecutionEnvironment } from "expo-constants";
import type { Settings } from "../data/repo";

type NotificationsModule = typeof import("expo-notifications");

export const remindersAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let mod: NotificationsModule | null = null;
function load(): NotificationsModule | null {
  if (!remindersAvailable) return null;
  if (!mod) {
    mod = require("expo-notifications") as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  }
  return mod;
}

export async function requestReminderPermission(): Promise<boolean> {
  const N = load();
  if (!N) return false;
  if ((await N.getPermissionsAsync()).granted) return true;
  return (await N.requestPermissionsAsync()).granted;
}

const PREFIX = "ballast-";

// Расписание на 7 дней вперёд: сегодня — только если ещё не взвешивались.
export async function syncReminder(s: Settings, weighedToday: boolean): Promise<void> {
  const N = load();
  if (!N) return;
  for (const n of await N.getAllScheduledNotificationsAsync()) if (n.identifier.startsWith(PREFIX)) await N.cancelScheduledNotificationAsync(n.identifier);
  if (!s.reminders || !(await N.getPermissionsAsync()).granted) return;
  const now = new Date();
  for (let d = weighedToday ? 1 : 0; d < 7; d++) {
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, s.reminderHour, 0, 0);
    if (when.getTime() <= now.getTime() + 30_000) continue;
    await N.scheduleNotificationAsync({
      identifier: `${PREFIX}${d}`,
      content: { title: "Morning weigh-in", body: "Same time, same scale — one tap keeps the trend honest." },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when },
    });
  }
}
