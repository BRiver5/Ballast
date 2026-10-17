// Сборка анализа: накопленное состояние тренда (из базы) + подогнанный ряд
// (пересборка по журналу — для графиков и объяснений) → цель, прогноз.

import type { Reading, Settings } from "../data/repo";
import { dayOf } from "../data/repo";
import { replay, noiseVar, weekdayEffects, weeklyRate, isPlateau, predict, type Fitted, type TrendState } from "../lib/trend.ts";
import { check, type Check, type Goal } from "../lib/goal.ts";
import { eta, type Eta } from "../lib/projection.ts";
import { dayNumber, todayLocal } from "../lib/time.ts";
import { fmtWeight } from "../lib/body.ts";

export type Analysis = {
  today: string;
  nowDay: number;
  state: TrendState | null;
  fitted: Fitted[];
  byId: Record<string, Fitted>;
  trendNow: number | null;
  rate: { mean: number; lo: number; hi: number; sd: number } | null;
  plateau: boolean;
  noiseSd: number | null;
  weekday: number[];
  goal: Goal | null;
  check: Check | null;
  eta: Eta | null;
};

export function goalOf(s: Settings): Goal | null {
  if (s.targetKg === null) return null;
  return { targetKg: s.targetKg, deadlineDay: s.deadline ? dayNumber(s.deadline) : null, paceLimit: s.paceLimit };
}

export function analyze(readings: Reading[], stored: TrendState | null, s: Settings): Analysis {
  const today = todayLocal();
  const d = new Date();
  const nowDay = dayNumber(today) + (d.getHours() * 60 + d.getMinutes()) / 1440;
  const rep = replay(readings.map((r) => ({ id: r.id, day: dayOf(r), kg: r.kg })));
  // Источник правды тренда — накопленное состояние; пересборка — подстраховка.
  const state = stored && readings.length ? stored : rep.state;
  const byId: Record<string, Fitted> = {};
  for (const f of rep.fitted) byId[f.id] = f;
  const goal = goalOf(s);
  const fmt = (kg: number) => fmtWeight(kg, s.units);
  return {
    today,
    nowDay,
    state,
    fitted: rep.fitted,
    byId,
    trendNow: state ? predict(state, nowDay).level : null,
    rate: state && state.n >= 3 ? weeklyRate(state) : null,
    plateau: state ? state.n >= 7 && isPlateau(state) : false,
    noiseSd: state ? Math.sqrt(noiseVar(state)) : null,
    weekday: state ? weekdayEffects(state) : new Array(7).fill(0),
    goal,
    check: state && goal ? check(state, nowDay, goal, fmt) : null,
    eta: state && goal && state.n >= 3 ? eta(state, nowDay, goal.targetKg) : null,
  };
}
