import { describe, expect, it } from "vitest";
import {
  buildArticleDraft,
  createSummary,
  extractFileName,
  sanitizeImportedText,
} from "./knowledgeBaseImportUtils";

describe("knowledge base import utils", () => {
  it("sanitizes control characters and preserves paragraph breaks", () => {
    const raw = "Line A\r\nLine B\n\nLine C\u0000";
    const sanitized = sanitizeImportedText(raw);
    expect(sanitized).toBe("Line A Line B\n\nLine C");
  });

  it("extracts file name from path", () => {
    expect(extractFileName("C:/Library/Guides/Jump.pdf")).toBe("Jump.pdf");
    expect(extractFileName("Jump.txt")).toBe("Jump.txt");
  });

  it("creates concise summaries", () => {
    const summary = createSummary([
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent fermentum varius lectus.",
    ]);
    expect(summary).toMatch(/^Lorem ipsum/);
    expect(summary?.length).toBeLessThanOrEqual(280);
  });

  it("builds a knowledge base article draft from raw text", () => {
    const draft = buildArticleDraft("C:/Guides/Example-Guide.txt", "Header\n\nThis is the first paragraph. It has enough detail to be captured.\n\nSecond paragraph.");
    expect(draft.payload.title).toBe("Example Guide");
    expect(draft.payload.summary).toContain("first paragraph");
  expect(draft.payload.content.includes("Second paragraph")).toBeTruthy();
    expect(draft.meta.wordCount).toBeGreaterThan(5);
    expect(draft.payload.source).toBe("Example-Guide.txt");
  });
});
