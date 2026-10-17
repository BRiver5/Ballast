// Агрегаты для экрана Stats — чистые функции над подогнанным рядом.

import { bandOf, bmi, type Band } from "./body.ts";
import { dow, type Fitted } from "./trend.ts";

// Изменение тренда по неделям (последнее значение тренда в неделе минус
// последнее в предыдущей). Неделя = 7 дней, заканчивающихся днём todayDay.
export function weeklyChange(f: Fitted[], todayDay: number, weeks = 10): { end: number; change: number | null }[] {
  const out: { end: number; change: number | null }[] = [];
  const lastIn = (from: number, to: number) => {
    let v: number | null = null;
    for (const x of f) if (x.day >= from && x.day < to) v = x.trend;
    return v;
  };
  for (let i = weeks - 1; i >= 0; i--) {
    const end = Math.floor(todayDay) + 1 - i * 7;
    const cur = lastIn(end - 7, end);
    const prev = lastIn(-Infinity, end - 7);
    out.push({ end, change: cur !== null && prev !== null ? cur - prev : null });
  }
  return out;
}

// Доля дней (между первым и последним взвешиванием) в каждой категории ИМТ — по тренду.
export function timeInBands(f: Fitted[], heightCm: number): Record<Band, number> {
  const r: Record<Band, number> = { under: 0, healthy: 0, over: 0, obese: 0 };
  for (let i = 0; i < f.length; i++) {
    const next = i + 1 < f.length ? f[i + 1].day : f[i].day + 1;
    const span = Math.max(0, Math.min(30, next - f[i].day));
    r[bandOf(bmi(f[i].trend, heightCm))] += span;
  }
  return r;
}

// Делим на недели, которые реально прошли с первого взвешивания (не больше
// `weeks`): иначе у нового пользователя выходило бы "2 в неделю" при ежедневных.
export function weighInsPerWeek(f: Fitted[], todayDay: number, weeks = 8): number {
  if (f.length === 0) return 0;
  const span = Math.min(weeks, Math.max(1, (Math.floor(todayDay) + 1 - Math.floor(f[0].day)) / 7));
  weeks = span;
  const from = todayDay - weeks * 7;
  const days = new Set(f.filter((x) => x.day > from).map((x) => Math.floor(x.day)));
  return days.size / weeks;
}

export function heat(f: Fitted[], todayDay: number, days = 84): number[] {
  const out = new Array(days).fill(0);
  const first = Math.floor(todayDay) - (days - 1);
  for (const x of f) {
    const i = Math.floor(x.day) - first;
    if (i >= 0 && i < days) out[i]++;
  }
  return out;
}

// Среднее отклонение от тренда по дням недели (сырые остатки — для подписи
// рядом с оценкой модели).
export function residualByWeekday(f: Fitted[]): { mean: number; n: number }[] {
  const acc = Array.from({ length: 7 }, () => ({ s: 0, n: 0 }));
  for (const x of f.slice(1)) {
    const d = dow(x.day);
    acc[d].s += x.kg - x.predLevel;
    acc[d].n++;
  }
  return acc.map((a) => ({ mean: a.n ? a.s / a.n : 0, n: a.n }));
}

export function streak(days: number[], todayDay: number): number {
  const set = new Set(days.map((d) => Math.floor(d)));
  let d = set.has(Math.floor(todayDay)) ? Math.floor(todayDay) : Math.floor(todayDay) - 1;
  let n = 0;
  while (set.has(d)) {
    n++;
    d--;
  }
  return n;
}
