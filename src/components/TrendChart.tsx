import { useMemo, useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useTheme } from "../theme";
import { residualColor } from "../theme/colors";
import type { Fitted } from "../lib/trend.ts";
import type { Band } from "../lib/projection.ts";
import { fromDayNumber, dayLabel } from "../lib/time.ts";
import { toDisplay, type Units } from "../lib/body.ts";
import { haptics } from "../services/haptics";

// График: точки — взвешивания (цвет — отклонение от тренда), линия — тренд,
// справа — конус прогноза (90%) и линия цели. Палец по графику — "скраб":
// вертикаль и подпись даты, тренда и взвешивания в этой точке.
export function TrendChart({
  fitted,
  cone,
  target,
  units,
  height = 220,
  fromDay,
}: {
  fitted: Fitted[];
  cone: Band[];
  target: number | null;
  units: Units;
  height?: number;
  fromDay: number;
}) {
  const t = useTheme();
  const [w, setW] = useState(320);
  const [scrub, setScrub] = useState<number | null>(null);
  const lastSlot = useRef<number | null>(null);
  const pts = fitted.filter((f) => f.day >= fromDay);
  const toDay = cone.length ? cone[cone.length - 1].day : pts.length ? pts[pts.length - 1].day + 1 : fromDay + 1;
  const vals = [...pts.map((p) => p.kg), ...pts.map((p) => p.trend), ...cone.map((c) => c.lo), ...cone.map((c) => c.hi), ...(target !== null ? [target] : [])];
  const lo = Math.min(...vals) - 0.4;
  const hi = Math.max(...vals) + 0.4;
  const padL = 36;
  const padB = 20;
  const X = (d: number) => padL + ((d - fromDay) / Math.max(1, toDay - fromDay)) * (w - padL - 8);
  const Y = (kg: number) => 8 + (1 - (kg - lo) / Math.max(0.1, hi - lo)) * (height - padB - 14);
  const trendPath = pts.map((p, i) => `${i ? "L" : "M"}${X(p.day).toFixed(1)},${Y(p.trend).toFixed(1)}`).join(" ");
  const conePath = cone.length
    ? `${cone.map((c, i) => `${i ? "L" : "M"}${X(c.day)},${Y(c.hi)}`).join(" ")} ${[...cone].reverse().map((c) => `L${X(c.day)},${Y(c.lo)}`).join(" ")} Z`
    : "";
  const ticks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  }, [lo, hi]);

  const atX = (x: number) => fromDay + ((x - padL) / Math.max(1, w - padL - 8)) * (toDay - fromDay);
  const move = (x: number) => {
    const d = Math.round(atX(x));
    if (d !== lastSlot.current) {
      lastSlot.current = d;
      haptics.tick();
    }
    setScrub(Math.max(fromDay, Math.min(toDay, atX(x))));
  };
  const end = () => {
    lastSlot.current = null;
    setScrub(null);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onBegin((e) => runOnJS(move)(e.x))
    .onUpdate((e) => runOnJS(move)(e.x))
    .onFinalize(() => runOnJS(end)());

  let tip: { day: number; trend: number; kg: number | null; future: boolean } | null = null;
  if (scrub !== null) {
    const near = pts.reduce<Fitted | null>((b, p) => (!b || Math.abs(p.day - scrub) < Math.abs(b.day - scrub) ? p : b), null);
    const last = pts[pts.length - 1];
    if (last && scrub > last.day && cone.length) {
      const c = cone.reduce((b, x) => (Math.abs(x.day - scrub) < Math.abs(b.day - scrub) ? x : b), cone[0]);
      tip = { day: c.day, trend: c.mid, kg: null, future: true };
    } else if (near) tip = { day: near.day, trend: near.trend, kg: Math.abs(near.day - scrub) < 1 ? near.kg : null, future: false };
  }
  const u = (kg: number) => toDisplay(kg, units).toFixed(1);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <GestureDetector gesture={pan}>
        <View>
          <Svg width={w} height={height}>
            {ticks.map((v) => (
              <SvgText key={v} x={padL - 6} y={Y(v) + 4} fontSize={10} fill={t.colors.inkMuted} textAnchor="end">
                {u(v)}
              </SvgText>
            ))}
            {ticks.map((v) => (
              <Line key={`g${v}`} x1={padL} x2={w - 8} y1={Y(v)} y2={Y(v)} stroke={t.colors.border} strokeWidth={0.6} />
            ))}
            {conePath ? <Path d={conePath} fill={t.colors.accent} fillOpacity={0.12} /> : null}
            {cone.length ? <Path d={cone.map((c, i) => `${i ? "L" : "M"}${X(c.day)},${Y(c.mid)}`).join(" ")} stroke={t.colors.accent} strokeWidth={2} strokeDasharray="5 4" fill="none" /> : null}
            {target !== null ? (
              <>
                <Line x1={padL} x2={w - 8} y1={Y(target)} y2={Y(target)} stroke={t.colors.success} strokeWidth={1.5} strokeDasharray="2 3" />
                <SvgText x={w - 10} y={Y(target) - 4} fontSize={10} fill={t.colors.success} textAnchor="end">
                  target
                </SvgText>
              </>
            ) : null}
            {pts.map((p) => (
              <Circle key={p.id} cx={X(p.day)} cy={Y(p.kg)} r={3.5} fill={residualColor(p.innovation / Math.sqrt(Math.max(1e-6, p.innovVar)))} />
            ))}
            <Path d={trendPath} stroke={t.colors.accentInk} strokeWidth={2.5} fill="none" />
            {tip ? (
              <>
                <Line x1={X(tip.day)} x2={X(tip.day)} y1={6} y2={height - padB} stroke={t.colors.ink} strokeWidth={1} />
                <Circle cx={X(tip.day)} cy={Y(tip.trend)} r={5} fill={t.colors.accentInk} stroke={t.colors.surface} strokeWidth={2} />
              </>
            ) : null}
            <Rect x={padL} y={height - padB} width={w - padL - 8} height={1} fill={t.colors.border} />
            {[fromDay, (fromDay + toDay) / 2, toDay].map((d, i) => (
              <SvgText key={i} x={X(d)} y={height - 4} fontSize={10} fill={t.colors.inkMuted} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
                {dayLabel(fromDayNumber(Math.floor(d)))}
              </SvgText>
            ))}
          </Svg>
        </View>
      </GestureDetector>
      <Text style={{ ...t.typography.caption, color: tip ? t.colors.ink : t.colors.inkMuted, minHeight: 18 }}>
        {tip
          ? `${dayLabel(fromDayNumber(Math.floor(tip.day)))} · ${tip.future ? "forecast" : "trend"} ${u(tip.trend)} ${units}${tip.kg !== null ? ` · scale ${u(tip.kg)} ${units}` : ""}`
          : "Drag across the chart to read any day."}
      </Text>
    </View>
  );
}
