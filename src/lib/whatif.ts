// "Что если": тот же расчёт цели при изменённых условиях — две колонки.

import { check, type Check, type Goal } from "./goal.ts";
import { eta, type Eta } from "./projection.ts";
import type { TrendState } from "./trend.ts";

export type Scenario = {
  pace: number | null; // "если держать такой темп", кг/неделю со знаком; null — как идёт тренд
  deadlineShiftWeeks: number;
  targetShift: number; // кг
};

export const NO_SCENARIO: Scenario = { pace: null, deadlineShiftWeeks: 0, targetShift: 0 };

export function isEmpty(s: Scenario): boolean {
  return s.pace === null && s.deadlineShiftWeeks === 0 && s.targetShift === 0;
}

export type Compare = { before: Check; after: Check; etaAfter: Eta; goalAfter: Goal };

export function compare(st: TrendState, nowDay: number, g: Goal, sc: Scenario, fmt: (kg: number) => string): Compare {
  const goalAfter: Goal = {
    ...g,
    targetKg: g.targetKg + sc.targetShift,
    deadlineDay: g.deadlineDay === null ? (sc.deadlineShiftWeeks ? nowDay + sc.deadlineShiftWeeks * 7 : null) : g.deadlineDay + sc.deadlineShiftWeeks * 7,
  };
  const before = check(st, nowDay, g, fmt);
  // Темп-сценарий: подменяем скорость тренда, неопределённость уровня оставляем.
  const st2: TrendState = sc.pace === null ? st : { ...st, slope: sc.pace / 7, p11: 1e-10, p01: 0 };
  const after = check(st2, nowDay, goalAfter, fmt);
  const etaAfter = eta(st, nowDay, goalAfter.targetKg, sc.pace === null ? null : sc.pace / 7);
  return { before, after: { ...after, eta: etaAfter }, etaAfter, goalAfter };
}
