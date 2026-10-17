// Manrope — заголовки и крупные числа (ровные цифры для весов); текст — системный.
export const fonts = {
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_800ExtraBold",
};

export const typography = {
  display: { fontSize: 32, fontFamily: fonts.bold, lineHeight: 40 },
  title: { fontSize: 21, fontFamily: fonts.bold, lineHeight: 28 },
  subtitle: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  overline: { fontSize: 11, fontWeight: "700" as const, lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase" as const },
  number: { fontFamily: fonts.semibold as string | undefined },
};
