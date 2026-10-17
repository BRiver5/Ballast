// Палитра Ballast — "лабораторный журнал": холодная светлая бумага, графит,
// кобальтовые чернила. Единственный файл с цветовыми значениями.
//
// Акцент #176CD3 — tools/palette-search.js: лучший сектор (213°) по
// минимальной Lab-дистанции до реестра; ближайшие соседи BrewDial #4C4FA9
// (ΔE 17.0) и StudyPlan #306CB5 (17.9). Белый на акценте 5.09:1; мелкий
// акцентный текст на фоне — accentInk (6.5:1).
// Категории ИМТ — спокойные, без "тревожного красного": это справка, не оценка.
// Тема только светлая.

export const light = {
  background: "#F3F6FA",
  backgroundAlt: "#E6ECF3",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F3F8",
  border: "#DAE1EA",
  ink: "#141B26",
  inkMuted: "#5A6474",
  inkFaint: "#98A2B1",
  onAccent: "#FFFFFF",
  accent: "#176CD3",
  accentInk: "#1257AE",
  accentSoft: "#E2EDFB",
  danger: "#B4362E",
  success: "#2E7D5B",
  signal: "#9C5F12",
  scrim: "rgba(20,27,38,0.45)",
  // background × 0.55 + ink × 0.45 — строка состояния, пока открыта шторка.
  statusDimmed: "#8E939B",
};

export const dark = light;
export type Palette = typeof light;

export const bandColor = { under: "#0F7C8C", healthy: "#2E7D5B", over: "#9C5F12", obese: "#8E3B66" } as const;
export const bandSoft = { under: "#DDF0F2", healthy: "#E1F0E9", over: "#F6ECDA", obese: "#F3E1EB" } as const;

// Отклонение взвешивания от тренда: ниже тренда — кобальт, выше — терракота,
// в пределах обычного разброса — серый. z — в единицах вашего разброса.
export function residualColor(z: number): string {
  if (Math.abs(z) < 0.5) return "#C9D2DE";
  if (z < 0) return Math.abs(z) < 1.5 ? "#8DB6EA" : "#176CD3";
  return Math.abs(z) < 1.5 ? "#E8B08F" : "#C2622E";
}

// Категориальная шкала (метки) — набор dataviz-скилла (validate_palette ALL PASS).
export const seriesColors = ["#2A78D6", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4", "#008300", "#6250D6"];

export function heatColor(t: number): string {
  if (t <= 0) return light.backgroundAlt;
  const stops = ["#C3D9F5", "#8DB6EA", "#4F8EDF", "#176CD3"];
  return stops[Math.min(stops.length - 1, Math.floor(t * stops.length - 1e-9))];
}
