// Цель и её проверка. Цель (вес) и предел темпа (кг/неделю) задаёт сам
// пользователь — приложение не советует, сколько худеть или набирать, а
// проверяет согласованность ЕГО собственных настроек с его же трендом.
//
// Статусы:
//  • reached   — тренд в пределах 0.3 кг от цели;
//  • onTrack   — медианный срок по тренду не позже дедлайна (или дедлайна нет);
//  • behind    — тренд не успевает, но нужный темп в пределах лимита;
//  • conflict  — нужный темп выше вашего лимита, дедлайн прошёл, или тренд
//                уверенно идёт в другую сторону. Для конфликта — выходы,
//                каждый проверен повторным расчётом.

import { eta, type Eta, REACHED_KG } from "./projection.ts";
import { predict, type TrendState } from "./trend.ts";

export type Goal = { targetKg: number; deadlineDay: number | null; paceLimit: number }; // paceLimit — кг/неделю

export type Status = "reached" | "onTrack" | "behind" | "conflict" | "noTrend";

export type AltKind = "laterDeadline" | "milestone" | "followTrend" | "dropDeadline";

export type Alternative = {
  kind: AltKind;
  title: string;
  detail: string;
  fixes: boolean;
  change: number; // величина изменения (дни или кг) — для ранжирования
  deadlineDay?: number | null;
  targetKg?: number;
};

export type Check = {
  status: Status;
  level: number;
  gap: number; // цель − уровень, кг
  weeksLeft: number | null;
  requiredPace: number | null; // кг/неделю (модуль)
  trendPace: number; // кг/неделю со знаком
  eta: Eta;
  reasons: string[];
  alternatives: Alternative[];
};

const WRONG_WAY_P = 0.2; // тренд идёт к цели с вероятностью меньше этой — "в другую сторону"

// fmtPace — темп с двумя знаками: 0.63 против лимита 0.5 не должно читаться как "0.6".
export function check(s: TrendState, nowDay: number, g: Goal, fmt: (kg: number) => string, fmtPace: (kg: number) => string = fmt): Check {
  const p = predict(s, nowDay);
  const gap = g.targetKg - p.level;
  const e = eta(s, nowDay, g.targetKg);
  const trendPace = p.slope * 7;
  const weeksLeft = g.deadlineDay === null ? null : (g.deadlineDay - nowDay) / 7;
  const requiredPace = weeksLeft === null ? null : weeksLeft > 0 ? Math.abs(gap) / weeksLeft : Infinity;
  const base = { level: p.level, gap, weeksLeft, requiredPace, trendPace, eta: e };

  if (e.reached) return { ...base, status: "reached", reasons: [], alternatives: [] };
  if (s.n < 3) return { ...base, status: "noTrend", reasons: ["A trend needs at least three weigh-ins."], alternatives: [] };

  const reasons: string[] = [];
  let conflict = false;
  if (weeksLeft !== null && weeksLeft <= 0) {
    conflict = true;
    reasons.push("The deadline has passed.");
  } else if (requiredPace !== null && requiredPace > g.paceLimit + 1e-9) {
    conflict = true;
    reasons.push(`Reaching ${fmt(g.targetKg)} by the deadline needs ${fmtPace(requiredPace)}/week — above your limit of ${fmtPace(g.paceLimit)}/week.`);
  }
  if (e.pToward < WRONG_WAY_P) {
    conflict = true;
    reasons.push(`Your trend is moving ${trendPace > 0 ? "up" : "down"} (${fmtPace(Math.abs(trendPace))}/week), away from the target.`);
  }

  if (!conflict) {
    const onTime = g.deadlineDay === null ? e.p50 !== null : e.p50 !== null && nowDay + e.p50 <= g.deadlineDay;
    if (onTime) return { ...base, status: "onTrack", reasons, alternatives: [] };
    reasons.push(
      e.p50 === null
        ? "At the current trend the target isn't reached within two years."
        : `At the current trend you'd get there in about ${Math.round(e.p50 / 7)} weeks${g.deadlineDay !== null ? ", after the deadline" : ""}.`,
    );
    return { ...base, status: "behind", reasons, alternatives: alternatives(s, nowDay, g, gap, e, fmt) };
  }
  return { ...base, status: "conflict", reasons, alternatives: alternatives(s, nowDay, g, gap, e, fmt) };
}

function alternatives(s: TrendState, nowDay: number, g: Goal, gap: number, e: Eta, fmt: (kg: number) => string): Alternative[] {
  const alts: Alternative[] = [];
  const atLimitDays = Math.ceil((Math.abs(gap) / g.paceLimit) * 7);

  // 1. Ближайший дедлайн, совместимый с вашим лимитом темпа.
  const later = nowDay + atLimitDays;
  if (g.deadlineDay === null || later !== g.deadlineDay) {
    const re = verify(s, nowDay, { ...g, deadlineDay: later });
    alts.push({
      kind: "laterDeadline",
      title: `Move the deadline to ${atLimitDays <= 13 ? `${atLimitDays} days` : `${Math.round(atLimitDays / 7)} weeks`} from now`,
      detail: `The earliest date at your ${fmt(g.paceLimit)}/week limit.`,
      fixes: re !== "conflict",
      change: Math.abs(later - (g.deadlineDay ?? later)),
      deadlineDay: later,
    });
  }

  // 2. Промежуточная цель к прежнему дедлайну на вашем лимите.
  if (g.deadlineDay !== null && g.deadlineDay > nowDay) {
    const weeks = (g.deadlineDay - nowDay) / 7;
    const level = predict(s, nowDay).level;
    const milestone = level + Math.sign(gap) * Math.min(Math.abs(gap), g.paceLimit * weeks);
    if (Math.abs(milestone - g.targetKg) > 0.05 && Math.abs(milestone - level) > REACHED_KG) {
      const re = verify(s, nowDay, { ...g, targetKg: milestone });
      alts.push({
        kind: "milestone",
        title: `Aim for ${fmt(milestone)} by the deadline first`,
        detail: "A milestone your limit allows; keep the full target for later.",
        fixes: re !== "conflict",
        change: Math.abs(milestone - g.targetKg) * 7,
        targetKg: milestone,
      });
    }
  }

  // 3. Просто следовать тренду — если он идёт к цели.
  if (e.p50 !== null && e.pToward >= WRONG_WAY_P) {
    const d = nowDay + e.p50;
    alts.push({
      kind: "followTrend",
      title: `Set the deadline to your trend's pace — about ${Math.round(e.p50 / 7)} weeks`,
      detail: `Likely between ${Math.round((e.p10 ?? e.p50) / 7)} and ${e.p90 === null ? "100+" : Math.round(e.p90 / 7)} weeks at the current trend.`,
      fixes: verify(s, nowDay, { ...g, deadlineDay: d }) !== "conflict",
      change: Math.abs(d - (g.deadlineDay ?? d)),
      deadlineDay: d,
    });
  }

  // 4. Без дедлайна — честный последний вариант.
  if (g.deadlineDay !== null) {
    alts.push({
      kind: "dropDeadline",
      title: "Keep the target, drop the deadline",
      detail: "Track progress without a date.",
      fixes: verify(s, nowDay, { ...g, deadlineDay: null }) !== "conflict",
      change: 100000,
      deadlineDay: null,
    });
  }
  return rank(alts);
}

function verify(s: TrendState, nowDay: number, g: Goal): Status {
  // Проверка выхода без рекурсии в альтернативы.
  const p = predict(s, nowDay);
  const gap = g.targetKg - p.level;
  if (Math.abs(gap) <= REACHED_KG) return "reached";
  const weeks = g.deadlineDay === null ? null : (g.deadlineDay - nowDay) / 7;
  if (weeks !== null && (weeks <= 0 || Math.abs(gap) / weeks > g.paceLimit + 1e-9)) return "conflict";
  return "behind";
}

export function rank(a: Alternative[]): Alternative[] {
  const last = (x: Alternative) => (x.kind === "dropDeadline" ? 1 : 0);
  return [...a].sort((x, y) => last(x) - last(y) || Number(y.fixes) - Number(x.fixes) || x.change - y.change);
}
