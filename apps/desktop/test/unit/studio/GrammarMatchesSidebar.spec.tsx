import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import GrammarMatchesSidebar from "../../../src/modules/studio/GrammarMatchesSidebar";
import type { GrammarSuggestionWithRange } from "../../../src/modules/studio/Editor";

describe("GrammarMatchesSidebar", () => {
  const suggestion: GrammarSuggestionWithRange = {
    id: "rule-1",
    message: "Possible typo detected",
    shortMessage: "Typo",
    replacements: [{ value: "example" }],
    offset: 0,
    length: 7,
    rule: {
      id: "R1",
      description: "Replace with example",
      issueType: "misspelling",
      category: "Spelling",
    },
    sentence: "exampel text",
    from: 1,
    to: 7,
  };

  it("renders suggestions and handles accept and ignore actions", async () => {
    const user = userEvent.setup();
    const handleAccept = vi.fn();
    const handleDismiss = vi.fn();

    render(
      <GrammarMatchesSidebar
        enabled
        loading={false}
        matches={[suggestion]}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByText(/Possible typo detected/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Accept suggestion: example/i }));
    expect(handleAccept).toHaveBeenCalledWith(suggestion, "example");

    await user.click(screen.getByRole("button", { name: /Ignore/i }));
    expect(handleDismiss).toHaveBeenCalledWith(suggestion);
  });

  it("supports toggling grammar suggestions on and off", async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(
      <GrammarMatchesSidebar
        enabled={false}
        loading={false}
        matches={[]}
        onAccept={() => {}}
        onDismiss={() => {}}
        onToggle={handleToggle}
      />,
    );

    expect(screen.getByText(/Grammar suggestions are disabled/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Enable/i }));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
