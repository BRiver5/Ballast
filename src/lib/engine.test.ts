import { test } from "node:test";
import assert from "node:assert/strict";
import { dow, noiseVar, replay, weekdayEffects, weeklyRate, isPlateau, type ReplayRow } from "./trend.ts";
import { bmi, bandOf, kgForBmi, fromDisplay, toDisplay, ftInToCm, cmToFtIn } from "./body.ts";
import { cone, eta } from "./projection.ts";
import { check } from "./goal.ts";
import { compare, NO_SCENARIO } from "./whatif.ts";
import { whyReading } from "./explain.ts";
import { tagEffects } from "./tags.ts";
import { weeklyChange, streak } from "./stats.ts";

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
function gauss(r: () => number) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// Синтетика: уровень 90 кг, −0.07 кг/день, шум sd, понедельник +0.6 кг.
function series(n: number, sd: number, slope = -0.07, monday = 0.6, seed = 3): ReplayRow[] {
  const r = rng(seed);
  const start = 20000;
  return Array.from({ length: n }, (_, i) => {
    const day = start + i;
    const kg = 90 + slope * i + (dow(day) === 0 ? monday : 0) + sd * gauss(r);
    return { id: String(i), day, kg };
  });
}

const fmt = (kg: number) => `${kg.toFixed(1)} kg`;

test("trend recovers the slope and the noise level", () => {
  const { state } = replay(series(120, 0.4));
  const w = weeklyRate(state!);
  assert.ok(Math.abs(w.mean - -0.49) < 0.12, `rate ${w.mean}`);
  assert.ok(w.lo < -0.49 && w.hi > -0.49, "interval covers the truth");
  const sd = Math.sqrt(noiseVar(state!));
  assert.ok(sd > 0.28 && sd < 0.55, `noise ${sd}`);
});

test("weekday effect is learned and centered", () => {
  const { state } = replay(series(140, 0.25));
  const w = weekdayEffects(state!);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0)) < 1e-9);
  assert.ok(w[0] > 0.3, `monday ${w[0]}`);
  assert.ok(w.slice(1).every((x) => x < 0.2));
});

test("plateau is detected on a flat series, not on a falling one", () => {
  assert.ok(isPlateau(replay(series(60, 0.3, 0, 0)).state!));
  assert.ok(!isPlateau(replay(series(60, 0.3, -0.1, 0)).state!));
});

test("bmi helpers and unit round-trips", () => {
  assert.equal(Math.round(bmi(70, 175) * 10) / 10, 22.9);
  assert.equal(bandOf(24.99), "healthy");
  assert.equal(bandOf(25), "over");
  assert.ok(Math.abs(bmi(kgForBmi(23, 180), 180) - 23) < 1e-9);
  assert.ok(Math.abs(fromDisplay(toDisplay(81.3, "lb"), "lb") - 81.3) < 1e-9);
  const fi = cmToFtIn(180);
  assert.equal(fi.ft, 5);
  assert.ok(Math.abs(ftInToCm(fi.ft, fi.inch) - 180) < 2);
});

test("projection cone widens and ETA matches the slope", () => {
  const rows = series(90, 0.3);
  const { state } = replay(rows);
  const now = rows[rows.length - 1].day;
  const c = cone(state!, now, 60);
  assert.ok(c[60].hi - c[60].lo > c[0].hi - c[0].lo);
  const level = state!.level;
  const e = eta(state!, now, level - 3.5);
  assert.ok(e.p50 !== null && Math.abs(e.p50 - 50) < 15, `eta ${e.p50}`);
  assert.ok(e.p10! <= e.p50! && e.p50! <= e.p90!);
  assert.ok(e.pToward > 0.95);
  const away = eta(state!, now, level + 3);
  assert.ok(away.pToward < 0.05 && away.p50 === null);
});

test("goal: limit conflict gets verified ways out; reachable goal is on track", () => {
  const rows = series(90, 0.3);
  const { state } = replay(rows);
  const now = rows[rows.length - 1].day;
  const L = state!.level;
  const tight = check(state!, now, { targetKg: L - 6, deadlineDay: now + 28, paceLimit: 0.5 }, fmt);
  assert.equal(tight.status, "conflict");
  const later = tight.alternatives.find((a) => a.kind === "laterDeadline")!;
  assert.ok(later.fixes);
  assert.equal(later.deadlineDay, now + Math.ceil((6 / 0.5) * 7));
  assert.equal(tight.alternatives[tight.alternatives.length - 1].kind, "dropDeadline");
  const re = check(state!, now, { targetKg: L - 6, deadlineDay: later.deadlineDay!, paceLimit: 0.5 }, fmt);
  assert.notEqual(re.status, "conflict");
  const easy = check(state!, now, { targetKg: L - 1, deadlineDay: now + 60, paceLimit: 1 }, fmt);
  assert.equal(easy.status, "onTrack");
  const wrong = check(state!, now, { targetKg: L + 4, deadlineDay: null, paceLimit: 1 }, fmt);
  assert.equal(wrong.status, "conflict");
});

test("what-if: a faster pace brings the ETA forward", () => {
  const rows = series(60, 0.3, -0.03);
  const { state } = replay(rows);
  const now = rows[rows.length - 1].day;
  const g = { targetKg: state!.level - 3, deadlineDay: null, paceLimit: 1 };
  const same = compare(state!, now, g, NO_SCENARIO, fmt);
  assert.equal(same.before.eta.p50, same.after.eta.p50);
  const fast = compare(state!, now, g, { ...NO_SCENARIO, pace: -0.5 }, fmt);
  assert.ok(fast.etaAfter.p50 !== null && fast.etaAfter.p50 < (same.before.eta.p50 ?? Infinity));
  assert.ok(Math.abs(fast.etaAfter.p50! - 42) < 10);
});

test("why: an outlier reading is unusual and barely moves the trend", () => {
  const rows = series(60, 0.25);
  rows.push({ id: "spike", day: rows[rows.length - 1].day + 1, kg: rows[rows.length - 1].kg + 2.5 });
  const { fitted } = replay(rows);
  const w = whyReading(fitted[fitted.length - 1]);
  assert.equal(w.verdict, "unusual");
  assert.ok(w.trendMove < 1.0 && w.trendMove > 0);
});

test("tag effects need enough data and a clear interval", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ tags: i % 4 === 0 ? ["Salty food"] : [], residual: (i % 4 === 0 ? 0.8 : 0) + ((i * 7) % 5) * 0.02 }));
  const e = tagEffects(rows);
  assert.equal(e[0].tag, "Salty food");
  assert.ok(e[0].clear && e[0].diff! > 0.6);
  const few = tagEffects([{ tags: ["Travel"], residual: 1 }, { tags: [], residual: 0 }, { tags: [], residual: 0 }]);
  assert.equal(few[0].clear, false);
});

test("stats: weekly change and streaks", () => {
  const rows = series(30, 0, -0.1, 0);
  const { fitted } = replay(rows);
  const today = rows[rows.length - 1].day;
  const wc = weeklyChange(fitted, today, 3);
  assert.ok(wc[2].change! < -0.4 && wc[2].change! > -1);
  assert.equal(streak(rows.map((r) => r.day), today), 30);
  assert.equal(streak(rows.map((r) => r.day), today + 1), 30);
});
