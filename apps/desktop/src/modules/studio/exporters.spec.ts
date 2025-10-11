import { beforeEach, describe, expect, it, vi } from "vitest";

const generateHtmlMock = vi.fn();
const createEntityMentionExtensionsMock = vi.fn();
const turndownCtor = vi.fn();
const getChapterTextMock = vi.fn();
const listChapterEntityLinksMock = vi.fn();

vi.mock("@tiptap/html", () => ({
  generateHTML: generateHtmlMock,
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: { name: "starter-kit" },
}));

vi.mock("./mentionExtension", () => ({
  createEntityMentionExtensions: createEntityMentionExtensionsMock,
}));

vi.mock("turndown", () => ({
  default: turndownCtor,
}));

vi.mock("../../db/dao", () => ({
  getChapterText: getChapterTextMock,
  listChapterEntityLinks: listChapterEntityLinksMock,
}));

type ExportersModule = typeof import("./exporters");

const baseChapter = {
  id: "chapter-1",
  story_id: "story-1",
  title: "First Chapter",
  sort_order: 0,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const baseStory = {
  id: "story-1",
  title: "Saga of Testing",
  summary: "",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  chapters: [baseChapter],
};

let turndownInstance: { turndown: ReturnType<typeof vi.fn> };

async function importExporters(): Promise<ExportersModule> {
  return import("./exporters");
}

beforeEach(() => {
  vi.clearAllMocks();

  generateHtmlMock.mockReturnValue("<p>Rendered chapter</p>");
  createEntityMentionExtensionsMock.mockReturnValue([{ name: "mention-extension" }]);
  listChapterEntityLinksMock.mockResolvedValue([
    { name: "Alice", type: "companion", mentions: 3 },
    { name: "Bob", type: "perk", mentions: 1 },
  ]);
  getChapterTextMock.mockResolvedValue({
    json: JSON.stringify({ type: "doc", content: [] }),
  });

  turndownInstance = {
    turndown: vi.fn().mockImplementation((html: string) => `md::${html}`),
  };
  turndownCtor.mockReturnValue(turndownInstance);
});

describe("export compositors", () => {
  it("builds HTML payloads with entity link summaries", async () => {
    const { exportChapter } = await importExporters();
    const payload = await exportChapter(baseStory, baseChapter, "html");

    expect(generateHtmlMock).toHaveBeenCalledTimes(1);
    expect(createEntityMentionExtensionsMock).toHaveBeenCalled();
    expect(payload.mime).toBe("text/html");
    expect(payload.filename).toBe("saga-of-testing-first-chapter.html");
    expect(payload.content).toContain("<article data-chapter=\"chapter-1\">");
    expect(payload.content).toContain("<section class=\"entity-links\">");
  });

  it("renders Markdown exports with sanitized filenames", async () => {
    const { exportChapter } = await importExporters();
    const payload = await exportChapter(baseStory, baseChapter, "markdown");

    expect(turndownInstance.turndown).toHaveBeenCalledWith("<p>Rendered chapter</p>");
    expect(payload.mime).toBe("text/markdown");
    expect(payload.filename).toBe("saga-of-testing-first-chapter.md");
    expect(payload.content).toContain("md::<p>Rendered chapter</p>");
    expect(payload.content).toContain("#### Entity Links");
  });

  it("falls back to BBCode exports when requested", async () => {
    const { exportChapter } = await importExporters();
    const payload = await exportChapter(baseStory, baseChapter, "bbcode");

    expect(payload.mime).toBe("text/plain");
    expect(payload.filename).toBe("saga-of-testing-first-chapter.bbcode");
    expect(payload.content).toContain("[center][size=140]First Chapter[/size][/center]");
    expect(payload.content).toContain("[li][b]Alice[/b] (companion) — 3 mentions[/li]");
  });

  it("composes multi-chapter stories by rendering each chapter", async () => {
    const exporters = await importExporters();
    generateHtmlMock.mockReset();
    generateHtmlMock
      .mockImplementationOnce(() => "<p>Chapter One Render</p>")
      .mockImplementationOnce(() => "<p>Chapter Two Render</p>");

    const story = {
      ...baseStory,
      title: "Complex Story",
      chapters: [
        baseChapter,
        {
          ...baseChapter,
          id: "chapter-2",
          title: "Second Chapter",
          sort_order: 1,
        },
      ],
    };

    const payload = await exporters.exportStory(story, "markdown");

    expect(generateHtmlMock).toHaveBeenCalledTimes(2);
    expect(payload.mime).toBe("text/markdown");
    expect(payload.content).toContain("# Complex Story");
    expect(payload.content).toContain("## First Chapter");
    expect(payload.content).toContain("## Second Chapter");
    expect(payload.content).toContain("md::<p>Chapter One Render</p>");
    expect(payload.content).toContain("md::<p>Chapter Two Render</p>");
  });
});
