import { describe, expect, it } from "vitest";
import { formatBudget, formatInputText } from "./formatter";

describe("formatInputText", () => {
  it("removes single line breaks but keeps doubles by default", () => {
    const input = "First line\r\nSecond line\r\n\r\nThird line";
    const result = formatInputText(input, {
      removeAllLineBreaks: false,
      leaveDoubleLineBreaks: false,
      xmlSafe: true,
    });
    expect(result).toBe("First line Second line\nThird line");
  });

  it("preserves double line breaks when requested", () => {
    const input = "Alpha\nBeta\n\nGamma";
    const result = formatInputText(input, {
      removeAllLineBreaks: false,
      leaveDoubleLineBreaks: true,
      xmlSafe: true,
    });
    expect(result).toBe("Alpha Beta\n\nGamma");
  });

  it("removes all line breaks when configured", () => {
    const input = "One\nTwo\r\nThree";
    const result = formatInputText(input, {
      removeAllLineBreaks: true,
      leaveDoubleLineBreaks: false,
      xmlSafe: true,
    });
    expect(result).toBe("One Two Three");
  });

  it("filters XML unsafe control characters", () => {
    const input = `Safe${String.fromCharCode(0)}Text`;
    const result = formatInputText(input, {
      removeAllLineBreaks: true,
      leaveDoubleLineBreaks: false,
      xmlSafe: true,
    });
    expect(result).toBe("SafeText");
  });
});

describe("formatBudget", () => {
  it("formats using commas", () => {
    expect(formatBudget(1234567, "comma")).toBe("1,234,567");
  });

  it("formats using spaces", () => {
    expect(formatBudget(9876543, "space")).toBe("9 876 543");
  });

  it("supports opting out of separators", () => {
    expect(formatBudget(1000000, "none")).toBe("1000000");
  });

  it("keeps negative values", () => {
    expect(formatBudget(-4200, "period")).toBe("-4.200");
  });
});
