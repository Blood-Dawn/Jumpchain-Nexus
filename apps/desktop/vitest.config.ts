import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/legacy/**", "src-tauri/**"],
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}", "src/__tests__/**/*.{ts,tsx}"],
    exclude: ["**/legacy/**", "src-tauri/**"],
  },
});
