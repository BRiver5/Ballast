// "Почему весы показали столько": взвешивание = тренд (прогноз до этого
// взвешивания) + сдвиг дня недели + шум. Шум сравнивается с ВАШИМ обычным
// разбросом (R из trend.ts), отсюда вердикт — обычное колебание или нет.

import type { Fitted } from "./trend.ts";

export type Why = {
  trend: number;
  weekday: number;
  noise: number;
  sd: number; // ваш обычный разброс, кг
  z: number;
  verdict: "typical" | "notable" | "unusual";
  trendMove: number; // насколько это взвешивание сдвинуло тренд
};

export function whyReading(f: Fitted): Why {
  const sd = Math.sqrt(Math.max(1e-6, f.innovVar));
  const z = f.innovation / sd;
  const az = Math.abs(z);
  return {
    trend: f.predLevel,
    weekday: f.weekday,
    noise: f.innovation,
    sd,
    z,
    verdict: az < 1.5 ? "typical" : az < 2.5 ? "notable" : "unusual",
    trendMove: f.trend - f.predLevel,
  };
}
