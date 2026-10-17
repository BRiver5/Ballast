// Прогноз из состояния тренда: где будет уровень через t дней (с полосой) и
// когда тренд дойдёт до цели — распределение срока по выборке (уровень,
// скорость) из апостериора Калмана. Выборка детерминированная (общий сид),
// поэтому сравнения сценариев не шумят.

import { predict, type TrendState } from "./trend.ts";

export type Band = { day: number; mid: number; lo: number; hi: number };

export function cone(s: TrendState, fromDay: number, days: number, step = 1): Band[] {
  const out: Band[] = [];
  for (let t = 0; t <= days; t += step) {
    const p = predict(s, fromDay + t);
    const sd = Math.sqrt(Math.max(0, p.p00));
    out.push({ day: fromDay + t, mid: p.level, lo: p.level - 1.645 * sd, hi: p.level + 1.645 * sd });
  }
  return out;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalPair(r: () => number): [number, number] {
  let u = 0;
  while (u === 0) u = r();
  const v = r();
  const m = Math.sqrt(-2 * Math.log(u));
  return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)];
}

export type Eta = {
  pToward: number; // вероятность, что тренд вообще идёт к цели
  p10: number | null; // дни до цели
  p50: number | null;
  p90: number | null;
  reached: boolean;
};

export const REACHED_KG = 0.3;
export const HORIZON = 730;

// slopeOverride — what-if "если держать такой темп" (кг/день, без неопределённости скорости).
export function eta(s: TrendState, nowDay: number, target: number, slopeOverride: number | null = null, sims = 3000): Eta {
  const p = predict(s, nowDay);
  if (Math.abs(p.level - target) <= REACHED_KG) return { pToward: 1, p10: 0, p50: 0, p90: 0, reached: true };
  const dir = Math.sign(target - p.level);
  const r = rng(12345);
  const sdL = Math.sqrt(Math.max(1e-12, p.p00));
  const sdS = slopeOverride === null ? Math.sqrt(Math.max(1e-12, p.p11)) : 0;
  const rho = slopeOverride === null ? Math.max(-0.99, Math.min(0.99, p.p01 / (sdL * Math.sqrt(Math.max(1e-12, p.p11))))) : 0;
  const slope0 = slopeOverride ?? p.slope;
  const days: number[] = [];
  let toward = 0;
  for (let i = 0; i < sims; i++) {
    const [z1, z2] = normalPair(r);
    const L = p.level + sdL * z1;
    const S = slope0 + sdS * (rho * z1 + Math.sqrt(1 - rho * rho) * z2);
    const gap = target - L;
    if (Math.sign(gap) !== dir && Math.abs(gap) > 0) {
      days.push(0);
      toward++;
      continue;
    }
    if (S * dir > 1e-6) {
      toward++;
      days.push(Math.min(HORIZON + 1, gap / S));
    } else days.push(Infinity);
  }
  days.sort((a, b) => a - b);
  const q = (x: number) => {
    const v = days[Math.min(days.length - 1, Math.floor(x * days.length))];
    return Number.isFinite(v) && v <= HORIZON ? Math.round(v) : null;
  };
  return { pToward: toward / sims, p10: q(0.1), p50: q(0.5), p90: q(0.9), reached: false };
}
