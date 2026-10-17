import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { actions } from "../src/store/actions";
import { Chip, IconButton, SectionTitle, Stepper } from "../src/components/Bits";
import { Toggle } from "../src/components/Toggle";
import { remindersAvailable, requestReminderPermission } from "../src/services/reminders";
import { setHapticsEnabled } from "../src/services/haptics";
import { cmToFtIn } from "../src/lib/body.ts";

export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useApp((x) => x.settings);

  const toggleReminders = async (on: boolean) => {
    if (on && !(await requestReminderPermission())) {
      Alert.alert("Notifications are off", remindersAvailable ? "Allow notifications for Ballast in system settings." : "Reminders work in the installed app, not in Expo Go.");
      return;
    }
    actions.setSetting("reminders", on);
  };
  const confirmReset = () =>
    Alert.alert("Erase everything?", "All weigh-ins, your goal and everything Ballast learned about your daily swings. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Erase", style: "destructive", onPress: () => actions.resetAll() },
    ]);

  const groups: { title: string; body: React.ReactNode }[] = [
    {
      title: "Body",
      body: (
        <>
          <Row title="Height" hint="Used only for BMI.">
            <Stepper
              value={s.heightCm}
              onChange={(v) => actions.setSetting("heightCm", v)}
              min={120}
              max={230}
              step={s.heightImperial ? 2.54 : 1}
              format={(v) => (s.heightImperial ? `${cmToFtIn(v).ft}′${cmToFtIn(v).inch}″` : `${Math.round(v)} cm`)}
            />
          </Row>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Weight in kg" active={s.units === "kg"} onPress={() => actions.setSetting("units", "kg")} />
            <Chip label="Weight in lb" active={s.units === "lb"} onPress={() => actions.setSetting("units", "lb")} />
            <Chip label="Height in cm" active={!s.heightImperial} onPress={() => actions.setSetting("heightImperial", false)} />
            <Chip label="Height in ft·in" active={s.heightImperial} onPress={() => actions.setSetting("heightImperial", true)} />
          </View>
        </>
      ),
    },
    {
      title: "Morning reminder",
      body: (
        <>
          <Row title="Remind me to weigh in" hint={remindersAvailable ? "Skipped on days you've already weighed in." : "Works in the installed app; Expo Go can't schedule it."}>
            <Toggle value={s.reminders} onValueChange={toggleReminders} />
          </Row>
          {s.reminders ? (
            <Row title="At">
              <Stepper value={s.reminderHour} onChange={(v) => actions.setSetting("reminderHour", v)} min={5} max={11} format={(v) => `${v}:00`} />
            </Row>
          ) : null}
        </>
      ),
    },
    {
      title: "Feel",
      body: (
        <Row title="Haptics" hint="Light taps on steppers, scrubbing and calendar swipes">
          <Toggle
            value={s.haptics}
            onValueChange={(v) => {
              setHapticsEnabled(v);
              actions.setSetting("haptics", v);
            }}
          />
        </Row>
      ),
    },
    {
      title: "How Ballast works",
      body: (
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, lineHeight: 19 }}>
          Your scale swings by water, salt and timing far more than your body actually changes day to day. Ballast runs a Kalman filter over your weigh-ins: it keeps a trend level and speed, learns how big your normal daily swing is and whether certain weekdays read high, and lets each new reading nudge the trend only as much as it deserves. Goals and pace limits are yours to set — Ballast checks them against your own trend and never recommends a weight. Not medical advice.
        </Text>
      ),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.display, color: t.colors.ink }}>Settings</Text>
      </View>
      {groups.map((g, i) => (
        <Animated.View key={g.title} entering={FadeInDown.delay(staggerDelay(i)).duration(400)} style={{ gap: 8 }}>
          <SectionTitle title={g.title} />
          <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md }}>{g.body}</View>
        </Animated.View>
      ))}
      <Chip label="Erase everything" active={false} icon={<Trash2 size={14} color={t.colors.danger} />} onPress={confirmReset} />
      <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Everything stays on this phone. No account, no network.</Text>
    </ScrollView>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{title}</Text>
        {hint ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}
