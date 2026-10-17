// ИМТ и единицы. Категории — стандартные взрослые пороги ВОЗ; ИМТ не учитывает
// телосложение, возраст и мышечную массу — приложение показывает его как
// справочную величину, без рекомендаций.

export const LB = 0.45359237;

export type Units = "kg" | "lb";
export type Band = "under" | "healthy" | "over" | "obese";

export const BAND_LABEL: Record<Band, string> = {
  under: "Underweight",
  healthy: "Healthy range",
  over: "Overweight",
  obese: "Obesity",
};

export const BAND_EDGES: [number, Band][] = [
  [18.5, "under"],
  [25, "healthy"],
  [30, "over"],
  [Infinity, "obese"],
];

export function bmi(kg: number, heightCm: number): number {
  const m = heightCm / 100;
  return m > 0 ? kg / (m * m) : 0;
}

export function bandOf(b: number): Band {
  for (const [edge, band] of BAND_EDGES) if (b < edge) return band;
  return "obese";
}

export function kgForBmi(b: number, heightCm: number): number {
  const m = heightCm / 100;
  return b * m * m;
}

export function toDisplay(kg: number, u: Units): number {
  return u === "kg" ? kg : kg / LB;
}

export function fromDisplay(v: number, u: Units): number {
  return u === "kg" ? v : v * LB;
}

export function fmtWeight(kg: number, u: Units, digits = 1): string {
  return `${toDisplay(kg, u).toFixed(digits)} ${u}`;
}

export function fmtDelta(kg: number, u: Units, digits = 1): string {
  const v = toDisplay(kg, u);
  const s = Math.abs(v) < 0.05 ? "0.0" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
  return `${s} ${u}`;
}

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const total = cm / 2.54;
  const ft = Math.floor(total / 12);
  return { ft, inch: Math.round(total - ft * 12) };
}

export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * 2.54;
}
