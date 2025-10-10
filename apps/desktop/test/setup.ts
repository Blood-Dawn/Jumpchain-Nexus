import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, expect, vi } from "vitest";
import { toHaveNoViolations } from "jest-axe";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";

// Teach Vitest about jest-dom matchers.
expect.extend(toHaveNoViolations);

// Initialize the lightweight IPC harness provided by the official Tauri mocks so
// that frontend tests can safely invoke command wrappers without touching the
// real runtime: https://tauri.app/v1/guides/testing/mocking
beforeAll(() => {
  mockIPC(vi.fn());
});

afterEach(() => {
  cleanup();
  clearMocks();
});
