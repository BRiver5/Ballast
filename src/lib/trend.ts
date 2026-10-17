// Тренд веса — фильтр Калмана "локальный линейный тренд" + сдвиги по дням недели.
//
// Состояние x = [уровень, скорость] (кг, кг/день), ковариация P. Между
// взвешиваниями уровень и скорость случайно блуждают (интегрированное
// блуждание скорости), наблюдение y = уровень + w[день недели] + шум.
//
// Накапливается от взвешивания к взвешиванию (состояние хранится и обновляется
// одной записью, а не пересчитывается):
//  • сам тренд (уровень, скорость, неопределённость);
//  • R — ВАШ обычный разброс весов от дня ко дню: оценка по инновациям
//    (квадрат отклонения от прогноза минус неопределённость самого прогноза),
//    с априором и забыванием;
//  • w[0..6] — систематический сдвиг по дням недели (у многих — "плюс
//    в понедельник"), со сжатием к нулю, пока данных мало, и центрированием.
// Удаление/правка записи — честная пересборка из журнала (replay).

export const Q_LEVEL = 0.05 ** 2; // кг² в день
export const Q_SLOPE = 0.004 ** 2; // (кг/день)² в день
export const R_PRIOR = 0.45 ** 2; // типичный разброс весов, кг²
const R_PRIOR_N = 4;
const W_SHRINK = 6;
const FORGET = 0.985; // на одно взвешивание — старое весит меньше
const SLOPE_SD0 = 0.02; // кг/день

export type TrendState = {
  level: number;
  slope: number;
  p00: number;
  p01: number;
  p11: number;
  day: number; // номер дня последнего обновления (дробный: день + минута/1440)
  rN: number;
  rS: number;
  wSum: number[];
  wCnt: number[];
  n: number;
};

export type Reading = { day: number; kg: number };

export function emptyState(): TrendState | null {
  return null;
}

export function noiseVar(s: TrendState): number {
  return s.rS / s.rN;
}

export function weekdayEffects(s: TrendState): number[] {
  const raw = s.wSum.map((v, i) => v / (s.wCnt[i] + W_SHRINK));
  const mean = raw.reduce((a, b) => a + b, 0) / 7;
  return raw.map((v) => v - mean);
}

export function dow(day: number): number {
  // день 0 = 1970-01-01, четверг; Пн = 0
  return (((Math.floor(day) + 3) % 7) + 7) % 7;
}

function init(r: Reading): TrendState {
  return {
    level: r.kg,
    slope: 0,
    p00: R_PRIOR,
    p01: 0,
    p11: SLOPE_SD0 ** 2,
    day: r.day,
    rN: R_PRIOR_N,
    rS: R_PRIOR_N * R_PRIOR,
    wSum: new Array(7).fill(0),
    wCnt: new Array(7).fill(0),
    n: 1,
  };
}

export type Predicted = { level: number; slope: number; p00: number; p01: number; p11: number };

// Прогноз состояния на момент day (без нового наблюдения).
export function predict(s: TrendState, day: number): Predicted {
  const dt = Math.max(0, day - s.day);
  const level = s.level + s.slope * dt;
  const p00 = s.p00 + 2 * dt * s.p01 + dt * dt * s.p11 + Q_LEVEL * dt + (Q_SLOPE * dt * dt * dt) / 3;
  const p01 = s.p01 + dt * s.p11 + (Q_SLOPE * dt * dt) / 2;
  const p11 = s.p11 + Q_SLOPE * dt;
  return { level, slope: s.slope, p00, p01, p11 };
}

export type Step = {
  state: TrendState;
  predLevel: number; // уровень тренда до учёта этого взвешивания
  weekday: number; // сдвиг дня недели, учтённый в прогнозе
  innovation: number; // y − (уровень + сдвиг)
  innovVar: number; // ожидаемая дисперсия инновации
};

export function update(prev: TrendState | null, r: Reading): Step {
  if (!prev) {
    const s = init(r);
    return { state: s, predLevel: r.kg, weekday: 0, innovation: 0, innovVar: R_PRIOR };
  }
  const pr = predict(prev, r.day);
  const d = dow(r.day);
  const w = weekdayEffects(prev)[d];
  const R = noiseVar(prev);
  const e = r.kg - (pr.level + w);
  const S = pr.p00 + R;
  const k0 = pr.p00 / S;
  const k1 = pr.p01 / S;
  const level = pr.level + k0 * e;
  const slope = pr.slope + k1 * e;
  const p00 = (1 - k0) * pr.p00;
  const p01 = (1 - k0) * pr.p01;
  const p11 = pr.p11 - k1 * pr.p01;
  // Разброс: сколько инновации осталось после неопределённости прогноза.
  const rObs = Math.max(0.01 ** 2, e * e - pr.p00);
  const rN = prev.rN * FORGET + 1;
  const rS = prev.rS * FORGET + rObs;
  const wSum = prev.wSum.map((v) => v * FORGET);
  const wCnt = prev.wCnt.map((v) => v * FORGET);
  wSum[d] += r.kg - pr.level;
  wCnt[d] += 1;
  return {
    state: { level, slope, p00, p01, p11: Math.max(1e-10, p11), day: Math.max(prev.day, r.day), rN, rS, wSum, wCnt, n: prev.n + 1 },
    predLevel: pr.level,
    weekday: w,
    innovation: e,
    innovVar: S,
  };
}

export type ReplayRow = Reading & { id: string };
export type Fitted = { id: string; day: number; kg: number; trend: number; predLevel: number; weekday: number; innovation: number; innovVar: number };

export function replay(rows: ReplayRow[]): { state: TrendState | null; fitted: Fitted[] } {
  let s: TrendState | null = null;
  const fitted: Fitted[] = [];
  for (const r of [...rows].sort((a, b) => a.day - b.day)) {
    const st = update(s, r);
    s = st.state;
    fitted.push({ id: r.id, day: r.day, kg: r.kg, trend: s.level, predLevel: st.predLevel, weekday: st.weekday, innovation: st.innovation, innovVar: st.innovVar });
  }
  return { state: s, fitted };
}

// Скорость в кг/неделю с 90% интервалом.
export function weeklyRate(s: TrendState): { mean: number; lo: number; hi: number; sd: number } {
  const sd = Math.sqrt(s.p11) * 7;
  const mean = s.slope * 7;
  return { mean, lo: mean - 1.645 * sd, hi: mean + 1.645 * sd, sd };
}

// "Плато": за неделю меньше 0.1 кг и интервал скорости захватывает ноль.
export function isPlateau(s: TrendState): boolean {
  const r = weeklyRate(s);
  return Math.abs(r.mean) < 0.1 && r.lo < 0 && r.hi > 0;
}
