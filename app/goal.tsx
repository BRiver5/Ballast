import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Flag, Milestone, TrendingDown } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { useApp } from "../src/store/appStore";
import { actions } from "../src/store/actions";
import { Chip, IconButton, SectionTitle, Stepper } from "../src/components/Bits";
import { Segmented } from "../src/components/Segmented";
import { BmiScale } from "../src/components/Body";
import { PressableScale } from "../src/components/PressableScale";
import { inputStyle } from "../src/components/Sheet";
import { compare, isEmpty, NO_SCENARIO, type Scenario } from "../src/lib/whatif.ts";
import type { Alternative, Check } from "../src/lib/goal.ts";
import { bmi, fmtDelta, fmtWeight, fromDisplay, kgForBmi, toDisplay } from "../src/lib/body.ts";
import { addDays, dayLabel, dayNumber, fromDayNumber } from "../src/lib/time.ts";
import { haptics } from "../src/services/haptics";
import { pct } from "../src/ui/format";

const ALT_ICON = { laterDeadline: CalendarClock, milestone: Milestone, followTrend: TrendingDown, dropDeadline: Flag };

export default function GoalScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { analysis: a, settings, version } = useApp();
  const u = settings.units;
  const fmt = (kg: number) => fmtWeight(kg, u);
  const [mode, setMode] = useState<"plan" | "whatif">("plan");
  const [sc, setSc] = useState<Scenario>(NO_SCENARIO);
  const [targetText, setTargetText] = useState(settings.targetKg !== null ? toDisplay(settings.targetKg, u).toFixed(1) : "");

  const wi = useMemo(
    () => (a?.state && a.goal && a.state.n >= 3 && mode === "whatif" && !isEmpty(sc) ? compare(a.state, a.nowDay, a.goal, sc, fmt) : null),
    [version, mode, sc],
  );
  if (!a) return null;
  const c = a.check;

  const commitTarget = (kg: number | null) => {
    actions.setSetting("targetKg", kg);
    setTargetText(kg !== null ? toDisplay(kg, u).toFixed(1) : "");
  };
  const apply = async (alt: Alternative) => {
    haptics.press();
    if (alt.deadlineDay !== undefined) await actions.setSetting("deadline", alt.deadlineDay === null ? null : fromDayNumber(alt.deadlineDay));
    if (alt.targetKg !== undefined) commitTarget(Math.round(alt.targetKg * 10) / 10);
  };
  const bmiPresets = [22, 24.9].map((b) => ({ l: `BMI ${b}`, kg: kgForBmi(b, settings.heightCm) }));
  const tr = a.trendNow;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.display, color: t.colors.ink }}>Goal</Text>
      </View>
      <Segmented items={[{ key: "plan", label: "Goal", badge: c?.status === "conflict" ? 1 : undefined }, { key: "whatif", label: "What if" }]} value={mode} onChange={setMode} />

      {mode === "plan" ? (
        <>
          <Animated.View entering={FadeInDown.duration(400)} style={card(t)}>
            <SectionTitle title="Your target" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TextInput
                value={targetText}
                onChangeText={setTargetText}
                onEndEditing={() => {
                  const v = Number(targetText.replace(",", "."));
                  commitTarget(Number.isFinite(v) && v > 20 ? fromDisplay(v, u) : null);
                }}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={t.colors.inkFaint}
                accessibilityLabel="Target weight"
                style={{ ...inputStyle(t), ...t.typography.title, flex: 1 }}
              />
              <Text style={{ ...t.typography.subtitle, color: t.colors.inkMuted }}>{u}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {tr !== null ? [-2, -5, 2].map((d) => <Chip key={d} label={`${d > 0 ? "+" : "−"}${Math.abs(toDisplay(d, u)).toFixed(0)} ${u} from trend`} active={false} onPress={() => commitTarget(Math.round((tr + d) * 10) / 10)} />) : null}
              {bmiPresets.map((p) => (
                <Chip key={p.l} label={`${p.l} · ${toDisplay(p.kg, u).toFixed(1)}`} active={false} onPress={() => commitTarget(Math.round(p.kg * 10) / 10)} />
              ))}
              {settings.targetKg !== null ? <Chip label="Clear" active={false} onPress={() => commitTarget(null)} /> : null}
            </View>
            <Row label="Deadline">
              <Stepper
                value={settings.deadline ? Math.round((dayNumber(settings.deadline) - Math.floor(a.nowDay)) / 7) : 0}
                onChange={(w) => actions.setSetting("deadline", w <= 0 ? null : addDays(a.today, w * 7))}
                min={0}
                max={104}
                format={(w) => (w <= 0 ? "none" : `${w} wk`)}
              />
            </Row>
            {settings.deadline ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{dayLabel(settings.deadline)} {settings.deadline.slice(0, 4)}</Text> : null}
            <Row label="Your pace limit">
              <Stepper value={Math.round(toDisplay(settings.paceLimit, u) * 10) / 10} onChange={(v) => actions.setSetting("paceLimit", fromDisplay(v, u))} min={0.1} max={2} step={0.1} format={(v) => `${v.toFixed(1)} ${u}/wk`} />
            </Row>
            <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>
              Your own ceiling for how fast you want to change. Ballast checks the goal against it — it doesn't recommend a target or a pace.
            </Text>
          </Animated.View>

          {a.goal && tr !== null ? (
            <View style={card(t)}>
              <SectionTitle title="Where you stand" />
              <BmiScale value={bmi(tr, settings.heightCm)} target={bmi(a.goal.targetKg, settings.heightCm)} />
              <Text style={{ ...t.typography.body, color: t.colors.ink }}>
                {fmtDelta(a.goal.targetKg - tr, u)} to go from your trend of {fmt(tr)}.
              </Text>
              {c ? <StatusBlock c={c} fmt={fmt} u={u} nowDay={a.nowDay} /> : null}
            </View>
          ) : null}

          {c && (c.status === "conflict" || c.status === "behind") && c.alternatives.length ? (
            <View style={{ ...card(t), borderColor: c.status === "conflict" ? t.colors.danger : t.colors.signal }}>
              <SectionTitle title="Ways to make it fit, best first" />
              {c.alternatives.map((alt, i) => {
                const Icon = ALT_ICON[alt.kind];
                return (
                  <View key={alt.kind} style={{ flexDirection: "row", gap: 10, padding: t.spacing.md, borderRadius: t.radius.md, backgroundColor: i === 0 && alt.fixes ? t.colors.accentSoft : t.colors.surfaceAlt }}>
                    <Icon size={18} color={alt.fixes ? t.colors.accentInk : t.colors.inkMuted} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{alt.title}</Text>
                      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{alt.detail}</Text>
                      <Text style={{ ...t.typography.caption, color: alt.fixes ? t.colors.success : t.colors.signal }}>{alt.fixes ? "Fits your limit" : "Still above your limit"}</Text>
                    </View>
                    <PressableScale
                      onPress={() => apply(alt)}
                      accessibilityLabel={`Apply: ${alt.title}`}
                      style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}
                    >
                      <CheckCircle2 size={14} color={t.colors.onAccent} />
                      <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.onAccent }}>
                        Apply
                      </Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={card(t)}>
            <SectionTitle title="Change something" />
            <Text style={{ ...t.typography.label, color: t.colors.inkMuted }}>If you kept this pace</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[null, -0.25, -0.5, -0.75, 0.25].map((p) => (
                <Chip key={String(p)} label={p === null ? "Current trend" : `${p > 0 ? "+" : "−"}${toDisplay(Math.abs(p), u).toFixed(2)} ${u}/wk`} active={sc.pace === p} onPress={() => setSc({ ...sc, pace: p })} />
              ))}
            </View>
            <Row label="Move the deadline">
              <Stepper value={sc.deadlineShiftWeeks} onChange={(v) => setSc({ ...sc, deadlineShiftWeeks: v })} min={-12} max={26} format={(v) => (v === 0 ? "as is" : `${v > 0 ? "+" : ""}${v} wk`)} />
            </Row>
            <Row label="Move the target">
              <Stepper value={Math.round(toDisplay(sc.targetShift, u) * 10) / 10} onChange={(v) => setSc({ ...sc, targetShift: fromDisplay(v, u) })} min={-10} max={10} step={0.5} format={(v) => (v === 0 ? "as is" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`)} />
            </Row>
          </View>
          {!a.goal ? (
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, textAlign: "center" }}>Set a target on the Goal tab first.</Text>
          ) : !wi ? (
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, textAlign: "center" }}>{a.state && a.state.n >= 3 ? "Change something above to compare." : "Needs at least three weigh-ins."}</Text>
          ) : (
            <Animated.View entering={FadeInDown.duration(350)} style={card(t)}>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ flex: 1.3 }} />
                <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, flex: 1, textAlign: "right" }}>Now</Text>
                <Text style={{ ...t.typography.overline, color: t.colors.accentInk, flex: 1, textAlign: "right" }}>What if</Text>
              </View>
              <Cmp label="Target" a={fmt(a.goal.targetKg)} b={fmt(wi.goalAfter.targetKg)} />
              <Cmp label="Deadline" a={a.goal.deadlineDay ? dayLabel(fromDayNumber(a.goal.deadlineDay)) : "none"} b={wi.goalAfter.deadlineDay ? dayLabel(fromDayNumber(wi.goalAfter.deadlineDay)) : "none"} />
              <Cmp label="Pace" a={`${fmtDelta(wi.before.trendPace, u)}/wk`} b={`${fmtDelta(sc.pace ?? wi.before.trendPace, u)}/wk`} />
              <Cmp label="Weeks to target" a={weeks(wi.before.eta.p50)} b={weeks(wi.etaAfter.p50)} better={(wi.etaAfter.p50 ?? 1e9) < (wi.before.eta.p50 ?? 1e9)} worse={(wi.etaAfter.p50 ?? 1e9) > (wi.before.eta.p50 ?? 1e9)} />
              <Cmp label="Needed per week" a={wi.before.requiredPace !== null ? fmt(wi.before.requiredPace) : "—"} b={wi.after.requiredPace !== null ? fmt(wi.after.requiredPace) : "—"} />
              <Cmp label="Status" a={STATUS[wi.before.status]} b={STATUS[wi.after.status]} />
              <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>
                "If you kept this pace" replaces your trend's speed, keeping today's level and its uncertainty.
              </Text>
            </Animated.View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const STATUS: Record<string, string> = { reached: "Reached", onTrack: "On track", behind: "Behind", conflict: "Doesn't fit", noTrend: "Too early" };

function weeks(d: number | null): string {
  if (d === null) return "not in 2 yrs";
  return d < 7 ? "<1" : String(Math.round(d / 7));
}

function StatusBlock({ c, fmt, u, nowDay }: { c: Check; fmt: (kg: number) => string; u: "kg" | "lb"; nowDay: number }) {
  const t = useTheme();
  const tone = c.status === "conflict" ? t.colors.danger : c.status === "behind" ? t.colors.signal : c.status === "noTrend" ? t.colors.inkMuted : t.colors.success;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {c.status === "conflict" || c.status === "behind" ? <AlertTriangle size={18} color={tone} /> : <CheckCircle2 size={18} color={tone} />}
        <Text style={{ ...t.typography.subtitle, color: tone }}>{STATUS[c.status]}</Text>
      </View>
      {c.reasons.map((r) => (
        <Text key={r} style={{ ...t.typography.body, color: t.colors.ink }}>
          {r}
        </Text>
      ))}
      {c.status !== "noTrend" && c.status !== "reached" ? (
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
          Trend {fmtDelta(c.trendPace, u)}/week · {pct(c.eta.pToward)} chance it's heading your way
          {c.eta.p50 !== null ? ` · at this pace about ${dayLabel(fromDayNumber(Math.floor(nowDay + c.eta.p50)))} (likely ${weeks(c.eta.p10)}–${weeks(c.eta.p90)} weeks)` : ""}
          {c.requiredPace !== null && Number.isFinite(c.requiredPace) ? ` · deadline needs ${fmt(c.requiredPace)}/week` : ""}
        </Text>
      ) : null}
    </View>
  );
}

function card(t: ReturnType<typeof useTheme>) {
  return { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md } as const;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

function Cmp({ label, a, b, better, worse }: { label: string; a: string; b: string; better?: boolean; worse?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
      <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1.3 }}>{label}</Text>
      <Text style={{ ...t.typography.label, color: t.colors.inkMuted, flex: 1, textAlign: "right" }}>{a}</Text>
      <Text style={{ ...t.typography.label, color: better ? t.colors.success : worse ? t.colors.danger : a !== b ? t.colors.accentInk : t.colors.ink, flex: 1, textAlign: "right" }}>{b}</Text>
    </View>
  );
}
