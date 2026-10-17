import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, X } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { bandColor, heatColor, residualColor, seriesColors } from "../src/theme/colors";
import { useApp } from "../src/store/appStore";
import { Chip, IconButton, Legend, SectionTitle } from "../src/components/Bits";
import { DonutChart } from "../src/components/DonutChart";
import { Heatmap } from "../src/components/Heatmap";
import { WeekdayBars } from "../src/components/Body";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { EmptyState } from "../src/components/EmptyState";
import { BAND_LABEL, fmtDelta, fmtWeight, type Band } from "../src/lib/body.ts";
import { dow, predict } from "../src/lib/trend.ts";
import { heat, streak, timeInBands, weeklyChange, weighInsPerWeek } from "../src/lib/stats.ts";
import { tagEffects, MIN_N } from "../src/lib/tags.ts";
import { dayLabel, fromDayNumber } from "../src/lib/time.ts";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function StatsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { analysis: a, readings, settings } = useApp();
  const [wd, setWd] = useState<number | null>(null);
  const u = settings.units;
  const fd = (kg: number) => fmtDelta(kg, u);

  const rows = useMemo(() => {
    if (!a) return [];
    return readings
      .map((r) => ({ r, f: a.byId[r.id] }))
      .filter((x) => x.f && a.fitted[0]?.id !== x.r.id)
      .map((x) => ({ ...x, z: x.f.innovation / Math.sqrt(Math.max(1e-6, x.f.innovVar)), resid: x.f.kg - x.f.predLevel }));
  }, [readings, a]);

  if (!a || !a.state || a.fitted.length < 2) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, gap: t.spacing.xl }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <EmptyState title="Not enough weigh-ins yet" description="A couple of days of weigh-ins and the charts fill in." />
      </View>
    );
  }

  // Выбранный день недели фильтрует секции с отдельными взвешиваниями.
  const sel = wd === null ? rows : rows.filter((x) => dow(x.f.day) === wd);
  const now = a.nowDay;
  const level30 = predict(a.state, now).level - (a.fitted.filter((f) => f.day <= now - 30).pop()?.trend ?? a.fitted[0].trend);
  const weeks = weeklyChange(a.fitted, now, 10);
  const wMax = Math.max(0.2, ...weeks.map((w) => Math.abs(w.change ?? 0)));
  const bands = timeInBands(a.fitted, settings.heightCm);
  const bandTotal = Object.values(bands).reduce((s, v) => s + v, 0) || 1;
  const tags = tagEffects(sel.map((x) => ({ tags: x.r.tags, residual: x.resid - a.weekday[dow(x.f.day)] })));
  const bins = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  const hist = new Array(bins.length + 1).fill(0);
  for (const x of sel) {
    let i = 0;
    while (i < bins.length && x.z >= bins[i]) i++;
    hist[i]++;
  }
  const hMax = Math.max(1, ...hist);
  const hm = heat(a.fitted, now, 84);
  const hmMax = Math.max(1, ...hm);
  let n = 0;
  const enter = () => FadeInDown.delay(staggerDelay(n++)).duration(400);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.display, color: t.colors.ink, flex: 1 }}>Stats</Text>
        {wd !== null ? <Chip label={`${WD[wd]}s only`} active icon={<X size={14} color={t.colors.onAccent} />} onPress={() => setWd(null)} /> : null}
      </View>

      {/* 1. Плитки */}
      <Animated.View entering={enter()} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Tile label="Trend change · 30 days" text={fd(level30)} />
        <Tile label="Weigh-ins per week" value={weighInsPerWeek(a.fitted, now)} digits={1} />
        <Tile label="Day streak" value={streak(a.fitted.map((f) => f.day), now)} />
        <Tile label="Your daily swing" text={`±${fmtWeight(a.noiseSd ?? 0, u)}`} />
      </Animated.View>

      {/* 2. Недели */}
      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Trend change by week" />
        <View style={{ flexDirection: "row", alignItems: "center", height: 120 }}>
          {weeks.map((w, i) => {
            const h = ((Math.abs(w.change ?? 0)) / wMax) * 52;
            const down = (w.change ?? 0) < 0;
            return (
              <View key={i} style={{ flex: 1, alignItems: "center", height: 120, justifyContent: "center" }}>
                <View style={{ height: 56, justifyContent: "flex-end", width: "60%" }}>{!down && w.change !== null ? <View style={{ height: h, backgroundColor: t.colors.signal, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} /> : null}</View>
                <View style={{ height: 1, width: "100%", backgroundColor: t.colors.border }} />
                <View style={{ height: 56, width: "60%" }}>{down ? <View style={{ height: h, backgroundColor: t.colors.accent, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} /> : null}</View>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{dayLabel(fromDayNumber(weeks[0].end - 1))}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>this week</Text>
        </View>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
          Last week {weeks[weeks.length - 1].change !== null ? fd(weeks[weeks.length - 1].change!) : "—"}. Blue down, amber up — of the trend, not the noisy scale.
        </Text>
      </Animated.View>

      {/* 3. Дни недели — интерактивно */}
      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Day-of-week pattern" />
        <WeekdayBars values={a.weekday} selected={wd} onSelect={setWd} fmt={fd} />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Tap a day to see only that weekday's weigh-ins in the sections below.</Text>
      </Animated.View>

      {/* 4. Разброс */}
      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title={`How far readings land from the trend${wd !== null ? ` · ${WD[wd]}` : ""}`} />
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 90 }}>
          {hist.map((v, i) => {
            const mid = i === 0 ? -3 : i === hist.length - 1 ? 3 : (bins[i - 1] + bins[i]) / 2;
            return (
              <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 10, color: t.colors.inkMuted }}>{v || ""}</Text>
                <View style={{ height: (v / hMax) * 64, width: "100%", borderRadius: 4, backgroundColor: residualColor(mid) }} />
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>below trend</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>above</Text>
        </View>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{sel.length} weigh-ins, in steps of your usual swing (±{fmtWeight(a.noiseSd ?? 0, u)}).</Text>
      </Animated.View>

      {/* 5. Метки */}
      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="What moves your scale" />
        {tags.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Tag weigh-ins (late meal, salty food, workout…) and Ballast checks which ones really shift the next reading.</Text> : null}
        {tags.map((g, i) => (
          <View key={g.tag} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seriesColors[i % seriesColors.length] }} />
            <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{g.tag}</Text>
            <Text style={{ ...t.typography.caption, color: g.clear ? t.colors.ink : t.colors.inkMuted }}>
              {g.diff === null ? `${g.n} of ${MIN_N} needed` : `${fd(g.diff)}${g.clear ? "" : " · could be chance"}`}
            </Text>
          </View>
        ))}
      </Animated.View>

      {/* 6. ИМТ */}
      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Time in each BMI range" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.lg }}>
          <DonutChart size={130} segments={(Object.keys(bands) as Band[]).map((b) => ({ value: bands[b], color: bandColor[b] }))} />
          <View style={{ flex: 1 }}>
            <Legend rows={(Object.keys(bands) as Band[]).filter((b) => bands[b] > 0).map((b) => ({ color: bandColor[b], label: BAND_LABEL[b], value: `${Math.round((bands[b] / bandTotal) * 100)}%` }))} />
          </View>
        </View>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>By trend weight, days since your first weigh-in. A reference only.</Text>
      </Animated.View>

      {/* 7. Активность */}
      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Weigh-ins · 12 weeks" />
        <Heatmap cells={hm.map((v, i) => ({ key: String(i), intensity: v / hmMax }))} colorForIntensity={heatColor} cellSize={16} gap={4} />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>More weigh-ins, tighter trend — even three a week help.</Text>
      </Animated.View>
    </ScrollView>
  );
}

function card(t: ReturnType<typeof useTheme>) {
  return { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md } as const;
}

function Tile({ label, value, text, digits = 0 }: { label: string; value?: number; text?: string; digits?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: "48%", flexGrow: 1, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.md, gap: 2 }}>
      {text !== undefined ? (
        <Text style={{ ...t.typography.title, color: t.colors.ink }}>{text}</Text>
      ) : (
        <AnimatedCounter
          value={value ?? 0}
          formatter={(v) => {
            "worklet";
            return v.toFixed(digits);
          }}
          style={{ ...t.typography.title, color: t.colors.ink, padding: 0 }}
        />
      )}
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{label}</Text>
    </View>
  );
}
