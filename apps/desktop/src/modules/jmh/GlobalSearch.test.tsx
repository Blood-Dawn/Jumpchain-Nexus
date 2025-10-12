import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type DaoModule = typeof import("../../db/dao");
type RouterModule = typeof import("react-router-dom");

type GlobalSearchResults = import("../../db/dao").GlobalSearchResults;

type JmhStore = typeof import("./store");

type GlobalSearchModule = typeof import("./GlobalSearch");

type MemoryRouterType = typeof import("react-router-dom").MemoryRouter;

const mockNavigate = vi.fn();

const mockResults: GlobalSearchResults = {
  chapters: [
    {
      id: "chapter-1",
      source: "chapter",
      title: "First Chapter",
      snippet: "Chapter snippet",
      score: 1,
      jump_id: "jump-1",
      story_id: "story-1",
      story_title: "Story One",
    },
  ],
  notes: [
    {
      id: "note-1",
      source: "note",
      title: "Jump Note",
      snippet: "Note snippet",
      score: 0.8,
      jump_id: "jump-1",
    },
  ],
  files: [
    {
      id: "file-1",
      source: "file",
      title: "Reference PDF",
      snippet: "File snippet",
      score: 0.6,
      jump_id: "jump-1",
    },
  ],
  entities: [],
};

const globalSearchMock = vi.fn(async () => mockResults);

vi.mock("../../db/dao", async (): Promise<DaoModule> => {
  const actual = await vi.importActual<DaoModule>("../../db/dao");
  return {
    ...actual,
    globalSearch: globalSearchMock,
  } satisfies DaoModule;
});

vi.mock("react-router-dom", async (): Promise<RouterModule> => {
  const actual = await vi.importActual<RouterModule>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  } satisfies RouterModule;
});

const { GlobalSearch } = (await import("./GlobalSearch")) as GlobalSearchModule;
const { useJmhStore } = (await import("./store")) as JmhStore;
const { MemoryRouter } = (await import("react-router-dom")) as { MemoryRouter: MemoryRouterType };

const renderSearch = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GlobalSearch />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("GlobalSearch command palette", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    globalSearchMock.mockClear();
    useJmhStore.setState({
      searchOpen: false,
      searchResults: null,
      selectedNoteId: null,
      selectedFileId: null,
      selectedJumpId: null,
    });
  });

  it("opens via keyboard shortcut and closes with escape", async () => {
    const user = userEvent.setup();
    renderSearch();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const dialog = await screen.findByRole("dialog", { name: /global search/i });
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /global search/i })).not.toBeInTheDocument();
    });
  });

  it("navigates results with arrow keys and activates the selected entry", async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.click(screen.getByRole("button", { name: /search the hub/i }));

    const input = await screen.findByRole("searchbox");
    await user.type(input, "arc");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(globalSearchMock).toHaveBeenCalled();
    });

    const [firstCall] = globalSearchMock.mock.calls;
    expect(firstCall?.[0]).toBe("arc");

    const listbox = await screen.findByRole("listbox");
    await waitFor(() => {
      const options = within(listbox).getAllByRole("option");
      expect(options[0]).toHaveAttribute("aria-selected", "true");
    });

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      const options = within(listbox).getAllByRole("option");
      expect(options[0]).toHaveAttribute("aria-selected", "false");
      expect(options[1]).toHaveAttribute("aria-selected", "true");
    });

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/hub");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /global search/i })).not.toBeInTheDocument();
    });
  });
});
