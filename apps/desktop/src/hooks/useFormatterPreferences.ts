import { useQuery } from "@tanstack/react-query";

import { loadFormatterSettings } from "../db/dao";

export const FORMATTER_PREFERENCES_QUERY_KEY = ["app-settings", "formatter"] as const;

export interface UseFormatterPreferencesOptions {
  enabled?: boolean;
}

export function useFormatterPreferences(options: UseFormatterPreferencesOptions = {}) {
  const { enabled } = options;
  return useQuery({
    queryKey: FORMATTER_PREFERENCES_QUERY_KEY,
    queryFn: loadFormatterSettings,
    ...(enabled !== undefined ? { enabled } : {}),
  });
}
