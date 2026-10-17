import { useMemo } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTheme } from "../theme";
import { residualColor } from "../theme/colors";
import { PressableScale } from "./PressableScale";
import { addMonthsKey, daysInMonth, monthLabelLong, weekdayLabel } from "../lib/time.ts";
import { haptics } from "../services/haptics";

export type DayMark = { z: number; count: number };

// Календарь месяца: точка в дне — взвешивание, её цвет — отклонение от тренда
// в единицах вашего обычного разброса (ниже тренда — синий, выше — терракота,
// обычное колебание — серый). Свайп влево/вправо — соседний месяц.
export function MonthCalendar({
  month,
  today,
  marks,
  selected,
  onMonth,
  onDay,
}: {
  month: string; // YYYY-MM
  today: string;
  marks: Record<string, DayMark>;
  selected: string | null;
  onMonth: (m: string) => void;
  onDay: (date: string) => void;
}) {
  const t = useTheme();
  const [y, m] = month.split("-").map(Number);
  const dim = daysInMonth(y, m);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = useMemo(() => {
    const out: (string | null)[] = new Array(lead).fill(null);
    for (let d = 1; d <= dim; d++) out.push(`${month}-${String(d).padStart(2, "0")}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const go = (dir: number) => {
    haptics.tick();
    onMonth(addMonthsKey(month, dir));
  };
  const swipe = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 60) runOnJS(go)(e.translationX < 0 ? 1 : -1);
    });

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <PressableScale accessibilityLabel="Previous month" onPress={() => go(-1)} style={{ padding: 6 }}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink, flex: 1, textAlign: "center" }}>{monthLabelLong(month)}</Text>
        <PressableScale accessibilityLabel="Next month" onPress={() => go(1)} style={{ padding: 6 }}>
          <ChevronRight size={20} color={t.colors.ink} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", ...t.typography.caption, fontSize: 11, color: t.colors.inkFaint }}>
            {d}
          </Text>
        ))}
      </View>
      <GestureDetector gesture={swipe}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((date, i) => {
            if (!date) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const mk = marks[date];
            const isToday = date === today;
            const isSel = date === selected;
            const future = date > today;
            return (
              <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                <PressableScale
                  onPress={() => !future && onDay(date)}
                  disabled={future}
                  accessibilityLabel={`${weekdayLabel(date)} ${Number(date.slice(8))}${mk ? ", weighed" : ""}`}
                  scaleTo={0.9}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    backgroundColor: isSel ? t.colors.accent : isToday ? t.colors.accentSoft : "transparent",
                  }}
                >
                  <Text style={{ ...t.typography.label, color: isSel ? t.colors.onAccent : future ? t.colors.inkFaint : t.colors.ink }}>{Number(date.slice(8))}</Text>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mk ? (isSel ? t.colors.onAccent : residualColor(mk.z)) : "transparent" }} />
                </PressableScale>
              </View>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}
