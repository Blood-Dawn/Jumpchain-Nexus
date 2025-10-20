/*
Bloodawn

Copyright (c) 2025 Bloodawn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InputFormatter from "./index";
import type { FormatterSettings } from "../../db/dao";
import { loadFormatterSettings, updateFormatterSettings } from "../../db/dao";
import {
  FORMATTER_PREFERENCES_QUERY_KEY,
  useFormatterPreferences,
} from "../../hooks/useFormatterPreferences";

const initialSettings: FormatterSettings = {
  removeAllLineBreaks: false,
  leaveDoubleLineBreaks: false,
  thousandsSeparator: "none",
  spellcheckEnabled: true,
};

const memorySettings: FormatterSettings = { ...initialSettings };

vi.mock("../../db/dao", async () => {
  const actual = await vi.importActual<typeof import("../../db/dao")>("../../db/dao");
  return {
    ...actual,
    loadFormatterSettings: vi.fn(async () => ({ ...memorySettings })),
    updateFormatterSettings: vi.fn(async (overrides: Partial<FormatterSettings>) => {
      Object.assign(memorySettings, overrides);
      return { ...memorySettings };
    }),
  };
});

const loadFormatterSettingsMock = loadFormatterSettings as unknown as Mock;
const updateFormatterSettingsMock = updateFormatterSettings as unknown as Mock;

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

function withProvider(client: QueryClient, children: ReactNode) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const ConnectedTextarea: React.FC = () => {
  const query = useFormatterPreferences();

  return (
    <textarea
      data-testid="connected-editor"
      spellCheck={query.data?.spellcheckEnabled ?? true}
      readOnly
    />
  );
};

beforeEach(() => {
  Object.assign(memorySettings, initialSettings);
  loadFormatterSettingsMock.mockClear();
  updateFormatterSettingsMock.mockClear();
});

describe("InputFormatter spellcheck preference", () => {
  it("persists spellcheck preference across remounts", async () => {
    const user = userEvent.setup();
    const client = createTestQueryClient();

    const { unmount } = render(withProvider(client, <InputFormatter />));

    const toggle = await screen.findByLabelText(/spellcheck/i);
    expect(toggle).toBeChecked();

    await user.click(toggle);
    await waitFor(() => expect(updateFormatterSettingsMock).toHaveBeenCalled());
    await waitFor(() => expect(toggle).not.toBeChecked());

    unmount();
    client.clear();

    const nextClient = createTestQueryClient();
    render(withProvider(nextClient, <InputFormatter />));
    await screen.findByLabelText(/spellcheck/i);
    await waitFor(() => expect(screen.getByLabelText(/spellcheck/i)).not.toBeChecked());
    nextClient.clear();
  });

  it("propagates updates to connected editors", async () => {
    const user = userEvent.setup();
    const client = createTestQueryClient();

    render(withProvider(client, (
      <>
        <InputFormatter />
        <ConnectedTextarea />
      </>
    )));

    const toggle = await screen.findByLabelText(/spellcheck/i);
    const connected = await screen.findByTestId("connected-editor");
    expect(toggle).toBeChecked();
    expect(connected).toHaveAttribute("spellcheck", "true");

    await user.click(toggle);
    await waitFor(() => expect(updateFormatterSettingsMock).toHaveBeenCalled());
    await waitFor(() => expect(connected).toHaveAttribute("spellcheck", "false"));

    client.clear();
  });

  it("reflects updates saved from Options without a reload", async () => {
    const client = createTestQueryClient();
    render(withProvider(client, <InputFormatter />));

    const toggle = await screen.findByLabelText(/spellcheck/i);
    expect(toggle).toBeChecked();

    await act(async () => {
      memorySettings.spellcheckEnabled = false;
      await client.invalidateQueries({
        queryKey: FORMATTER_PREFERENCES_QUERY_KEY,
        refetchType: "active",
      });
    });

    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(updateFormatterSettingsMock).not.toHaveBeenCalled();
    expect(loadFormatterSettingsMock).toHaveBeenCalledTimes(2);

    client.clear();
  });
});
