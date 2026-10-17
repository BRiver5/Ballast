import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { Chip, IconButton, SectionTitle } from "../src/components/Bits";
import { TrendChart } from "../src/components/TrendChart";
import { BmiScale, WeekdayBars } from "../src/components/Body";
import { EmptyState } from "../src/components/EmptyState";
import { cone } from "../src/lib/projection.ts";
import { bmi, fmtDelta, fmtWeight } from "../src/lib/body.ts";

const RANGES = [
  { l: "1M", d: 30 },
  { l: "3M", d: 91 },
  { l: "6M", d: 182 },
  { l: "All", d: 100000 },
];

export default function TrendScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { analysis: a, settings } = useApp();
  const [range, setRange] = useState(1);
  const u = settings.units;
  const fmtD = (kg: number) => fmtDelta(kg, u);

  const ahead = useMemo(() => {
    if (!a?.state || a.state.n < 3) return [];
    const days = a.eta?.p50 != null ? Math.min(Math.max(14, a.eta.p50 + 7), 120) : 28;
    return cone(a.state, a.nowDay, days, 2);
  }, [a]);

  if (!a || a.fitted.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, gap: t.spacing.xl }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <EmptyState title="No weigh-ins yet" description="Tap today in the calendar to log your first one." />
      </View>
    );
  }

  const first = a.fitted[0].day;
  const from = Math.max(first, a.nowDay - RANGES[range].d);
  const tr = a.trendNow!;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.display, color: t.colors.ink }}>Trend</Text>
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={card(t)}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {RANGES.map((r, i) => (
            <Chip key={r.l} label={r.l} active={range === i} onPress={() => setRange(i)} />
          ))}
        </View>
        <TrendChart fitted={a.fitted} cone={ahead} target={a.goal?.targetKg ?? null} units={u} fromDay={from} />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
          The line is your trend — scale readings with the daily water, salt and timing swings filtered out. The shaded cone is where it's likely heading.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ flexDirection: "row", gap: 10 }}>
        <Tile label="Trend" value={fmtWeight(tr, u)} note={`BMI ${bmi(tr, settings.heightCm).toFixed(1)}`} />
        <Tile label="Per week" value={a.rate ? fmtD(a.rate.mean) : "—"} note={a.rate ? (a.plateau ? "holding steady" : `±${fmtD(a.rate.hi - a.rate.mean).replace("+", "")}`) : "needs 3 weigh-ins"} />
        <Tile label="Daily swing" value={a.noiseSd !== null ? `±${fmtWeight(a.noiseSd, u)}` : "—"} note="your usual noise" />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={card(t)}>
        <SectionTitle title="BMI" />
        <BmiScale value={bmi(tr, settings.heightCm)} target={a.goal ? bmi(a.goal.targetKg, settings.heightCm) : null} />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
          From your trend weight and a height of {Math.round(settings.heightCm)} cm. BMI is a rough population measure — it doesn't know your build or muscle.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(staggerDelay(3)).duration(400)} style={card(t)}>
        <SectionTitle title="Your day-of-week pattern" />
        <WeekdayBars values={a.weekday} selected={null} fmt={fmtD} />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
          How far each weekday's reading tends to sit from the trend, learned from your history and shrunk toward zero until there's enough of it. Ballast subtracts this before updating the trend.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

function card(t: ReturnType<typeof useTheme>) {
  return { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md } as const;
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.md, gap: 2 }}>
      <Text style={{ ...t.typography.caption, fontSize: 11, color: t.colors.inkMuted }}>{label}</Text>
      <Text style={{ ...t.typography.subtitle, fontFamily: t.typography.number.fontFamily, color: t.colors.ink }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ ...t.typography.caption, fontSize: 11, color: t.colors.inkFaint }} numberOfLines={1}>
        {note}
      </Text>
    </View>
  );
}
