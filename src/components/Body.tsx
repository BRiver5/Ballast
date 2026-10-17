import { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../theme";
import { bandColor } from "../theme/colors";
import { BAND_EDGES, BAND_LABEL, type Band } from "../lib/body.ts";
import { haptics } from "../services/haptics";

// Шкала ИМТ 15–40 с четырьмя категориями, маркер — текущий ИМТ по тренду,
// флажок — ИМТ цели. Справочно, без оценок.
export function BmiScale({ value, target }: { value: number | null; target: number | null }) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const min = 15;
  const max = 40;
  const X = (b: number) => ((Math.max(min, Math.min(max, b)) - min) / (max - min)) * w;
  let from = min;
  const segs = BAND_EDGES.map(([edge, band]) => {
    const s = { band, a: from, b: Math.min(edge, max) };
    from = edge;
    return s;
  });
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={46}>
        {segs.map((s) => (
          <Rect key={s.band} x={X(s.a) + 1} y={14} width={Math.max(0, X(s.b) - X(s.a) - 2)} height={10} rx={5} fill={bandColor[s.band]} fillOpacity={0.85} />
        ))}
        {target !== null ? <Path d={`M${X(target)},12 l-5,-9 l10,0 Z`} fill={t.colors.success} /> : null}
        {value !== null ? <Line x1={X(value)} x2={X(value)} y1={8} y2={30} stroke={t.colors.ink} strokeWidth={3} strokeLinecap="round" /> : null}
        {[18.5, 25, 30].map((v) => (
          <SvgText key={v} x={X(v)} y={42} fontSize={10} fill={t.colors.inkMuted} textAnchor="middle">
            {v}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

// Разложение взвешивания: тренд + сдвиг дня недели + шум — полосой со знаком.
export function Decomposition({ weekday, noise, sd, fmt }: { weekday: number; noise: number; sd: number; fmt: (kg: number) => string }) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const span = Math.max(Math.abs(weekday) + Math.abs(noise), 2 * sd, 0.5);
  const X = (v: number) => w / 2 + (v / span) * (w / 2 - 6);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ gap: 6 }}>
      <Svg width={w} height={44}>
        <Rect x={X(-sd)} y={6} width={X(sd) - X(-sd)} height={30} rx={6} fill={t.colors.backgroundAlt} />
        <Line x1={X(0)} x2={X(0)} y1={2} y2={42} stroke={t.colors.ink} strokeWidth={1.5} />
        <Rect x={Math.min(X(0), X(weekday))} y={10} width={Math.abs(X(weekday) - X(0))} height={10} rx={3} fill={t.colors.signal} />
        <Rect x={Math.min(X(weekday), X(weekday + noise))} y={22} width={Math.abs(X(weekday + noise) - X(weekday))} height={10} rx={3} fill={t.colors.accent} />
      </Svg>
      <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
        <Key color={t.colors.signal} label={`Day-of-week ${fmt(weekday)}`} />
        <Key color={t.colors.accent} label={`Noise ${fmt(noise)}`} />
        <Key color={t.colors.backgroundAlt} label={`Your usual swing ±${fmt(sd).replace("+", "")}`} />
      </View>
    </View>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, borderWidth: 1, borderColor: t.colors.border }} />
      <Text style={{ ...t.typography.caption, color: t.colors.ink }}>{label}</Text>
    </View>
  );
}

// Сдвиги по дням недели: столбцы вверх/вниз от нуля; тап выбирает день.
export function WeekdayBars({ values, selected, onSelect, fmt }: { values: number[]; selected: number | null; onSelect?: (i: number | null) => void; fmt: (kg: number) => string }) {
  const t = useTheme();
  const max = Math.max(0.2, ...values.map((v) => Math.abs(v)));
  const H = 46;
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => {
        const v = values[i];
        const h = (Math.abs(v) / max) * H;
        return (
          <Pressable
            key={d}
            style={{ flex: 1, alignItems: "center", opacity: selected === null || selected === i ? 1 : 0.35 }}
            onPress={() => {
              if (!onSelect) return;
              haptics.tick();
              onSelect(selected === i ? null : i);
            }}
            accessibilityLabel={`${d} ${fmt(v)}`}
          >
            <View style={{ height: H, width: "70%", justifyContent: "flex-end" }}>{v > 0 ? <View style={{ height: h, backgroundColor: t.colors.signal, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} /> : null}</View>
            <View style={{ height: 1, width: "100%", backgroundColor: t.colors.ink }} />
            <View style={{ height: H, width: "70%" }}>{v < 0 ? <View style={{ height: h, backgroundColor: t.colors.accent, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} /> : null}</View>
            <Text style={{ fontSize: 11, color: selected === i ? t.colors.accentInk : t.colors.inkMuted }}>{d}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BandPill({ band }: { band: Band }) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: t.radius.pill, backgroundColor: bandColor[band] }}>
      <Text numberOfLines={1} style={{ ...t.typography.label, fontSize: 12, color: t.colors.onAccent }}>
        {BAND_LABEL[band]}
      </Text>
    </View>
  );
}
