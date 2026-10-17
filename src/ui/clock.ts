export function nowMinuteOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function clock(m: number): string {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${Math.floor(mm / 60)}:${String(mm % 60).padStart(2, "0")}`;
}
