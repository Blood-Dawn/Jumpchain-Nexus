import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { AppearanceSettings, AppearanceTheme } from "../db/dao";
import { useOptionsStore } from "../stores/optionsStore";

interface AppearanceContextValue {
  appearance: AppearanceSettings;
  theme: AppearanceTheme;
  hydrated: boolean;
  setTheme: (theme: AppearanceTheme) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const appearance = useOptionsStore((state) => state.appearance);
  const theme = appearance.theme;
  const hydrated = useOptionsStore((state) => state.hydrated);
  const hydrate = useOptionsStore((state) => state.hydrate);
  const setTheme = useOptionsStore((state) => state.setAppearanceTheme);

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  const value = useMemo(
    () => ({
      appearance,
      theme,
      hydrated,
      setTheme,
    }),
    [appearance, hydrated, setTheme, theme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};

export const useAppearance = (): AppearanceContextValue => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used within an AppearanceProvider");
  }
  return context;
};
