// Метки взвешиваний ("поздний ужин", "солёное", "тренировка"...) и их связь с
// отклонением от тренда: среднее отклонение с меткой против без неё, 90%
// интервал Уэлча; вывод "сдвигает" — только если интервал не задевает ноль и
// с меткой не меньше MIN_N взвешиваний. Это ваши наблюдения, не правило.

export const TAGS = ["Late meal", "Salty food", "Alcohol", "Workout", "Poor sleep", "Travel", "Rest day"] as const;
export const MIN_N = 3;

export type TagEffect = { tag: string; n: number; diff: number | null; lo: number | null; hi: number | null; clear: boolean };

function meanVar(xs: number[]): { m: number; v: number } {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.length > 1 ? xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) : 0;
  return { m, v };
}

export function tagEffects(rows: { tags: string[]; residual: number }[]): TagEffect[] {
  const all = new Set<string>();
  for (const r of rows) for (const t of r.tags) all.add(t);
  return [...all]
    .map((tag) => {
      const yes = rows.filter((r) => r.tags.includes(tag)).map((r) => r.residual);
      const no = rows.filter((r) => !r.tags.includes(tag)).map((r) => r.residual);
      if (yes.length < MIN_N || no.length < 2) return { tag, n: yes.length, diff: null, lo: null, hi: null, clear: false };
      const a = meanVar(yes);
      const b = meanVar(no);
      const diff = a.m - b.m;
      const se = Math.sqrt(a.v / yes.length + b.v / no.length);
      const lo = diff - 1.645 * se;
      const hi = diff + 1.645 * se;
      return { tag, n: yes.length, diff, lo, hi, clear: lo > 0 || hi < 0 };
    })
    .sort((x, y) => Math.abs(y.diff ?? 0) - Math.abs(x.diff ?? 0));
}
