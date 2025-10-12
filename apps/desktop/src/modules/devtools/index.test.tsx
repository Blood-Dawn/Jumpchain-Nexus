import { describe, expect, it } from "vitest";

import { appendLogEntry, LOG_CAP, type LogEntry } from "./index";

const createLog = (id: number, overrides: Partial<LogEntry> = {}): LogEntry => ({
  id,
  timestamp: new Date(id * 1_000).toISOString(),
  level: "info",
  message: `message-${id}`,
  source: "stdout",
  ...overrides,
});

describe("appendLogEntry", () => {
  it("appends entries while under the cap", () => {
    const initial = Array.from({ length: 5 }, (_, index) => createLog(index));
    const result = appendLogEntry(initial, createLog(5));

    expect(result).toHaveLength(6);
    expect(result[result.length - 1]).toMatchObject({ id: 5, message: "message-5" });
  });

  it("trims to the last 500 entries when the cap is exceeded", () => {
    const initial = Array.from({ length: LOG_CAP }, (_, index) => createLog(index));
    const result = appendLogEntry(initial, createLog(LOG_CAP));

    expect(result).toHaveLength(LOG_CAP);
    expect(result[0].id).toBe(1);
    expect(result[result.length - 1].id).toBe(LOG_CAP);
  });
});
