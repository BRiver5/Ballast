import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Plus, Trash2 } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { staggerDelay } from "../../src/theme/motion";
import { seriesColors } from "../../src/theme/colors";
import { useApp } from "../../src/store/appStore";
import { actions } from "../../src/store/actions";
import { Chip, IconButton, SectionTitle } from "../../src/components/Bits";
import { Decomposition } from "../../src/components/Body";
import { SwipeRow } from "../../src/components/SwipeRow";
import { WeighSheet } from "../../src/components/WeighSheet";
import { EmptyState } from "../../src/components/EmptyState";
import { whyReading } from "../../src/lib/explain.ts";
import { TAGS } from "../../src/lib/tags.ts";
import { fmtDelta, fmtWeight, fromDisplay, toDisplay } from "../../src/lib/body.ts";
import { dayLabel, weekdayLabel } from "../../src/lib/time.ts";
import { clock } from "../../src/ui/clock";
import type { Reading } from "../../src/data/repo";

const VERDICT = {
  typical: "A normal day-to-day swing.",
  notable: "A bigger swing than usual.",
  unusual: "Unusual for you — the trend treats it with caution.",
};

export default function DayScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { readings, analysis: a } = useApp();
  const [adding, setAdding] = useState(false);
  const own = readings.filter((r) => r.date === date).sort((x, y) => x.minute - y.minute);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IconButton label="Back" onPress={() => router.back()}>
            <ArrowLeft size={18} color={t.colors.ink} />
          </IconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.typography.title, color: t.colors.ink }}>
              {weekdayLabel(date)}, {dayLabel(date)}
            </Text>
          </View>
          <Chip label="Add another" active icon={<Plus size={14} color={t.colors.onAccent} />} onPress={() => setAdding(true)} />
        </View>
        {own.length === 0 ? <EmptyState title="Nothing logged" description="This day has no weigh-ins anymore." /> : null}
        {own.map((r, i) => (
          <Animated.View key={r.id} entering={FadeInDown.delay(staggerDelay(i)).duration(400)}>
            <SwipeRow left={{ label: "Delete", icon: <Trash2 size={16} color={t.colors.onAccent} />, onTrigger: () => actions.remove(r.id) }}>
              <ReadingCard r={r} />
            </SwipeRow>
          </Animated.View>
        ))}
        {own.length ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Swipe a card left to delete it. Tap the weight to correct it.</Text> : null}
      </ScrollView>
      <WeighSheet visible={adding} onClose={() => setAdding(false)} date={date ?? a?.today ?? ""} />
    </View>
  );
}

function ReadingCard({ r }: { r: Reading }) {
  const t = useTheme();
  const { analysis: a, settings } = useApp();
  const u = settings.units;
  const [text, setText] = useState(toDisplay(r.kg, u).toFixed(1));
  const [note, setNote] = useState(r.note);
  const f = a?.byId[r.id];
  const why = f && a && a.fitted[0]?.id !== r.id ? whyReading(f) : null;
  const commit = () => {
    const v = Number(text.replace(",", "."));
    if (Number.isFinite(v) && v > 20 && Math.abs(fromDisplay(v, u) - r.kg) > 0.001) actions.update(r.id, { kg: fromDisplay(v, u) });
    else setText(toDisplay(r.kg, u).toFixed(1));
  };
  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          accessibilityLabel="Weight, tap to correct"
          style={{ ...t.typography.display, color: t.colors.ink, padding: 0, minWidth: 80 }}
        />
        <Text style={{ ...t.typography.subtitle, color: t.colors.inkMuted, marginBottom: 6 }}>{u}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ ...t.typography.label, color: t.colors.inkMuted, marginBottom: 8 }}>{clock(r.minute)}</Text>
      </View>

      {why ? (
        <>
          <SectionTitle title="Why the scale said this" />
          <Text style={{ ...t.typography.body, color: t.colors.ink }}>
            Trend before this weigh-in: {fmtWeight(why.trend, u)}. {VERDICT[why.verdict]}
          </Text>
          <Decomposition weekday={why.weekday} noise={why.noise} sd={why.sd} fmt={(kg) => fmtDelta(kg, u)} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            Reading = trend {fmtWeight(why.trend, u)} {why.weekday >= 0 ? "+" : "−"} {fmtWeight(Math.abs(why.weekday), u)} for this weekday {why.noise >= 0 ? "+" : "−"} {fmtWeight(Math.abs(why.noise), u)} of noise ({Math.abs(why.z).toFixed(1)}× your usual swing). It moved the trend by {fmtDelta(why.trendMove, u)}.
          </Text>
        </>
      ) : (
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Your first weigh-in — the trend starts here.</Text>
      )}

      <SectionTitle title="Tags" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TAGS.map((tag, i) => {
          const on = r.tags.includes(tag);
          return <Chip key={tag} label={tag} color={seriesColors[i % seriesColors.length]} active={on} onPress={() => actions.update(r.id, { tags: on ? r.tags.filter((x) => x !== tag) : [...r.tags, tag] })} />;
        })}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        onEndEditing={() => note !== r.note && actions.update(r.id, { note: note.trim() })}
        placeholder="Add a note"
        placeholderTextColor={t.colors.inkFaint}
        style={{ ...t.typography.body, color: t.colors.ink, borderBottomWidth: 1, borderColor: t.colors.border, paddingVertical: 6 }}
      />
    </View>
  );
}
