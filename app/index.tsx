import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, ChevronRight, Flag, LineChart, Settings2, Scale } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { actions } from "../src/store/actions";
import { MonthCalendar, type DayMark } from "../src/components/Calendar";
import { WeighSheet } from "../src/components/WeighSheet";
import { BandPill } from "../src/components/Body";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { IconButton, Chip, Stepper } from "../src/components/Bits";
import { PressableScale } from "../src/components/PressableScale";
import { bandOf, bmi, cmToFtIn, fmtDelta, fmtWeight, toDisplay } from "../src/lib/body.ts";
import { monthKey } from "../src/lib/time.ts";
import { plural } from "../src/ui/format";

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { analysis: a, readings, settings } = useApp();
  const [month, setMonth] = useState(() => monthKey(a?.today ?? "2026-01-01"));
  const [logDate, setLogDate] = useState<string | null>(null);
  const u = settings.units;

  const marks = useMemo(() => {
    const m: Record<string, DayMark> = {};
    if (!a) return m;
    for (const r of readings) {
      const f = a.byId[r.id];
      const z = f && f.innovVar > 0 ? f.innovation / Math.sqrt(f.innovVar) : 0;
      const prev = m[r.date];
      m[r.date] = { z: prev ? prev.z : z, count: (prev?.count ?? 0) + 1 };
    }
    return m;
  }, [readings, a]);

  if (!a) return null;
  const tr = a.trendNow;
  const b = tr !== null ? bmi(tr, settings.heightCm) : null;
  const inMonth = readings.filter((r) => r.date.startsWith(month));
  const monthFitted = a.fitted.filter((f) => readings.find((r) => r.id === f.id)?.date.startsWith(month));
  const monthChange = monthFitted.length >= 2 ? monthFitted[monthFitted.length - 1].trend - monthFitted[0].trend : null;
  const weighedToday = readings.some((r) => r.date === a.today);

  const onDay = (date: string) => {
    if (marks[date]) router.push(`/day/${date}`);
    else setLogDate(date);
  };

  const goalLine = (() => {
    const c = a.check;
    if (!a.goal) return { text: "No goal set — optional", tone: t.colors.inkMuted };
    if (!c) return { text: "Log a few weigh-ins to check your goal", tone: t.colors.inkMuted };
    switch (c.status) {
      case "reached":
        return { text: "Goal reached", tone: t.colors.success };
      case "onTrack":
        return { text: c.eta.p50 !== null ? `On track · about ${Math.max(1, Math.round(c.eta.p50 / 7))} weeks to go` : "On track", tone: t.colors.success };
      case "behind":
        return { text: "Behind the deadline — see options", tone: t.colors.signal };
      case "conflict":
        return { text: "Goal doesn't fit your own limits — see why", tone: t.colors.danger };
      default:
        return { text: "A trend needs three weigh-ins", tone: t.colors.inkMuted };
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ ...t.typography.title, color: t.colors.ink, flex: 1 }}>Ballast</Text>
          <IconButton label="Trend" onPress={() => router.push("/trend")}>
            <LineChart size={18} color={t.colors.ink} />
          </IconButton>
          <IconButton label="Goal" onPress={() => router.push("/goal")}>
            <Flag size={18} color={t.colors.ink} />
          </IconButton>
          <IconButton label="Stats" onPress={() => router.push("/stats")}>
            <BarChart3 size={18} color={t.colors.ink} />
          </IconButton>
          <IconButton label="Settings" onPress={() => router.push("/settings")}>
            <Settings2 size={18} color={t.colors.ink} />
          </IconButton>
        </View>

        {!settings.onboarded ? <StartCard /> : null}

        <Animated.View entering={FadeInDown.duration(400)}>
          <PressableScale onPress={() => router.push("/trend")} scaleTo={0.98} style={{ ...card(t), gap: 6 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Trend weight today</Text>
            {tr !== null ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <AnimatedCounter
                  value={toDisplay(tr, u)}
                  formatter={(v) => {
                    "worklet";
                    return v.toFixed(1);
                  }}
                  style={{ ...t.typography.display, fontSize: 44, lineHeight: 52, color: t.colors.ink, padding: 0 }}
                />
                <Text style={{ ...t.typography.subtitle, color: t.colors.inkMuted, marginBottom: 8 }}>{u}</Text>
                <View style={{ flex: 1 }} />
                {b !== null ? <BandPill band={bandOf(b)} /> : null}
              </View>
            ) : (
              <Text style={{ ...t.typography.subtitle, color: t.colors.inkMuted }}>Tap today in the calendar to log your first weigh-in.</Text>
            )}
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              {a.rate
                ? `${fmtDelta(a.rate.mean, u)}/week · likely ${fmtDelta(a.rate.lo, u)} to ${fmtDelta(a.rate.hi, u)}${a.plateau ? " · holding steady" : ""}`
                : tr !== null
                  ? "The trend firms up after a few weigh-ins."
                  : "Ballast smooths out daily water swings to show where your weight is really heading."}
              {b !== null ? ` · BMI ${b.toFixed(1)}` : ""}
            </Text>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)}>
          <PressableScale onPress={() => router.push("/goal")} scaleTo={0.98} style={{ ...card(t), flexDirection: "row", alignItems: "center", gap: 12, padding: t.spacing.md }}>
            <Flag size={18} color={goalLine.tone} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{a.goal ? `Goal ${fmtWeight(a.goal.targetKg, u)}` : "Goal"}</Text>
              <Text style={{ ...t.typography.caption, color: goalLine.tone }}>{goalLine.text}</Text>
            </View>
            <ChevronRight size={18} color={t.colors.inkFaint} />
          </PressableScale>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={card(t)}>
          <MonthCalendar month={month} today={a.today} marks={marks} selected={null} onMonth={setMonth} onDay={onDay} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Scale size={16} color={t.colors.inkMuted} />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, flex: 1 }}>
              {weighedToday ? "Tap a day to see its weigh-ins." : "Tap today to log your weight; past days work too."} Dot colour: blue below trend, orange above, grey a normal swing.
            </Text>
          </View>
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>
            {plural(inMonth.length, "weigh-in")} this month{monthChange !== null ? ` · trend ${fmtDelta(monthChange, u)}` : ""}
          </Text>
        </Animated.View>
      </ScrollView>
      <WeighSheet visible={logDate !== null} onClose={() => setLogDate(null)} date={logDate ?? a.today} />
    </View>
  );
}

// Первая настройка — рост и единицы; без них ИМТ не считается.
function StartCard() {
  const t = useTheme();
  const s = useApp((x) => x.settings);
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ ...card(t), borderColor: t.colors.accent }}>
      <Text style={{ ...t.typography.title, color: t.colors.ink }}>Two things first</Text>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Your height (for BMI) and the units your scale shows. Change them any time in Settings.</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip label="kg / cm" active={s.units === "kg"} onPress={() => (actions.setSetting("units", "kg"), actions.setSetting("heightImperial", false))} />
        <Chip label="lb / ft·in" active={s.units === "lb"} onPress={() => (actions.setSetting("units", "lb"), actions.setSetting("heightImperial", true))} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>Height</Text>
        <Stepper
          value={s.heightCm}
          onChange={(v) => actions.setSetting("heightCm", v)}
          min={120}
          max={230}
          step={s.heightImperial ? 2.54 : 1}
          format={(v) => (s.heightImperial ? `${cmToFtIn(v).ft}′${cmToFtIn(v).inch}″` : `${Math.round(v)} cm`)}
        />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Chip label="Done" active onPress={() => actions.setSetting("onboarded", true)} />
      </View>
    </Animated.View>
  );
}

function card(t: ReturnType<typeof useTheme>) {
  return { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md } as const;
}
