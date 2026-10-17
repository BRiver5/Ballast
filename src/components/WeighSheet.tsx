import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { useTheme } from "../theme";
import { seriesColors } from "../theme/colors";
import { Sheet, Field, inputStyle } from "./Sheet";
import { Chip } from "./Bits";
import { PressableScale } from "./PressableScale";
import { PrimaryButton } from "./PrimaryButton";
import { SuccessBurst } from "./SuccessBurst";
import { useApp } from "../store/appStore";
import { actions } from "../store/actions";
import { haptics } from "../services/haptics";
import { TAGS } from "../lib/tags.ts";
import { fromDisplay, toDisplay } from "../lib/body.ts";
import { dayLabel, weekdayLabel } from "../lib/time.ts";
import { nowMinuteOf } from "../ui/clock";

// Шторка взвешивания. Дата приходит из календаря (тап по дню); вес —
// крупное число со степперами и пресетами "как тренд" / "как в прошлый раз".
export function WeighSheet({ visible, onClose, date }: { visible: boolean; onClose: () => void; date: string }) {
  const t = useTheme();
  const { settings, analysis, readings } = useApp();
  const u = settings.units;
  const last = readings.length ? readings[readings.length - 1] : null;
  const isToday = analysis?.today === date;
  const [text, setText] = useState("");
  const [minute, setMinute] = useState(450);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const base = analysis?.trendNow ?? last?.kg ?? null;
    setText(base !== null ? toDisplay(base, u).toFixed(1) : "");
    setMinute(isToday ? nowMinuteOf(new Date()) : 450);
    setTags([]);
    setNote("");
    setBurst(false);
  }, [visible, date]);

  const value = Number(text.replace(",", "."));
  const valid = Number.isFinite(value) && value > 20 && value < 700;
  const bump = (d: number) => {
    const v = (valid ? value : 0) + d;
    haptics.tick();
    setText(Math.max(0, v).toFixed(1));
  };
  const presets: { label: string; kg: number }[] = [];
  if (analysis?.trendNow != null) presets.push({ label: "Trend", kg: analysis.trendNow });
  if (last) presets.push({ label: "Last weigh-in", kg: last.kg });

  const submit = async () => {
    if (!valid || burst) return;
    haptics.success();
    setBurst(true);
    await actions.add({ date, minute, kg: fromDisplay(value, u), tags, note: note.trim() });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Log a weigh-in"
      subtitle={`${weekdayLabel(date)}, ${dayLabel(date)} — same scale, ideally same time of day.`}
      footer={
        burst ? (
          <View style={{ alignItems: "center" }}>
            <SuccessBurst visible size={56} onDone={() => setTimeout(onClose, 250)} />
          </View>
        ) : (
          <PrimaryButton label={valid ? `Save ${value.toFixed(1)} ${u}` : "Enter your weight"} onPress={submit} disabled={!valid} />
        )
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Step icon={<Minus size={16} color={t.colors.ink} />} label="−1" onPress={() => bump(-1)} />
        <Step icon={<Minus size={14} color={t.colors.ink} />} label="−0.1" onPress={() => bump(-0.1)} />
        <View style={{ alignItems: "center", minWidth: 120 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Weight"
            style={{ ...t.typography.display, fontSize: 40, lineHeight: 48, color: t.colors.ink, textAlign: "center", padding: 0, minWidth: 110 }}
          />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{u}</Text>
        </View>
        <Step icon={<Plus size={14} color={t.colors.ink} />} label="+0.1" onPress={() => bump(0.1)} />
        <Step icon={<Plus size={16} color={t.colors.ink} />} label="+1" onPress={() => bump(1)} />
      </View>
      {presets.length ? (
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {presets.map((p) => (
            <Chip key={p.label} label={`${p.label} · ${toDisplay(p.kg, u).toFixed(1)}`} active={false} onPress={() => setText(toDisplay(p.kg, u).toFixed(1))} />
          ))}
        </View>
      ) : null}
      <Field label="When">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            { l: "Morning", m: 450 },
            ...(isToday ? [{ l: "Just now", m: nowMinuteOf(new Date()) }] : []),
            { l: "Midday", m: 780 },
            { l: "Evening", m: 1260 },
          ].map((o) => (
            <Chip key={o.l} label={o.l} active={minute === o.m} onPress={() => setMinute(o.m)} />
          ))}
        </View>
      </Field>
      <Field label="Anything unusual yesterday?" hint="Optional. Stats checks which of these actually move your scale.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TAGS.map((tag, i) => {
            const on = tags.includes(tag);
            return <Chip key={tag} label={tag} color={seriesColors[i % seriesColors.length]} active={on} onPress={() => setTags(on ? tags.filter((x) => x !== tag) : [...tags, tag])} />;
          })}
        </View>
      </Field>
      <Field label="Note">
        <TextInput value={note} onChangeText={setNote} placeholder="Optional" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
      </Field>
    </Sheet>
  );
}

function Step({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      scaleTo={0.9}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border }}
    >
      {icon}
      <Text style={{ fontSize: 9, color: t.colors.inkMuted }}>{label.replace(/[−+]/, "")}</Text>
    </PressableScale>
  );
}
