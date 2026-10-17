import { create } from "zustand";
import { loadAll, DEFAULT_SETTINGS, type Reading, type Settings } from "../data/repo";
import { analyze, type Analysis } from "./analysis";
import { setHapticsEnabled } from "../services/haptics";
import { syncReminder } from "../services/reminders";

type State = {
  ready: boolean;
  readings: Reading[];
  settings: Settings;
  analysis: Analysis | null;
  version: number;
  refresh: () => Promise<void>;
};

export const useApp = create<State>((set, get) => ({
  ready: false,
  readings: [],
  settings: DEFAULT_SETTINGS,
  analysis: null,
  version: 0,
  refresh: async () => {
    const { readings, settings, model } = await loadAll();
    setHapticsEnabled(settings.haptics);
    const analysis = analyze(readings, model, settings);
    set({ ready: true, readings, settings, analysis, version: get().version + 1 });
    syncReminder(settings, readings.some((r) => r.date === analysis.today)).catch(() => {});
  },
}));
