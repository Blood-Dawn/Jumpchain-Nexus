import { create } from "zustand";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSettings,
  type AppearanceTheme,
} from "../db/dao";

interface OptionsState {
  appearance: AppearanceSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setAppearanceTheme: (theme: AppearanceTheme) => Promise<void>;
  setAppearanceSettings: (settings: AppearanceSettings) => Promise<void>;
}

export const useOptionsStore = create<OptionsState>((set, get) => ({
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  hydrated: false,
  async hydrate() {
    if (get().hydrated) {
      return;
    }

    try {
      const appearance = await loadAppearanceSettings();
      set({ appearance, hydrated: true });
    } catch (error) {
      console.error("Failed to load appearance settings", error);
      set({ appearance: DEFAULT_APPEARANCE_SETTINGS, hydrated: true });
    }
  },
  async setAppearanceTheme(theme) {
    const next = { ...get().appearance, theme } satisfies AppearanceSettings;
    set({ appearance: next });
    try {
      const persisted = await saveAppearanceSettings(next);
      set({ appearance: persisted });
    } catch (error) {
      console.error("Failed to persist appearance theme", error);
    }
  },
  async setAppearanceSettings(settings) {
    set({ appearance: settings });
    try {
      const persisted = await saveAppearanceSettings(settings);
      set({ appearance: persisted });
    } catch (error) {
      console.error("Failed to persist appearance settings", error);
    }
  },
}));
