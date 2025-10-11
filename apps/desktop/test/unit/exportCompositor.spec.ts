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

vi.mock("../../src/modules/studio/mentionExtension", () => ({
  createEntityMentionExtensions: createEntityMentionExtensionsMock,
}));

vi.mock("turndown", () => ({
  default: turndownCtor,
}));

vi.mock("../../src/db/dao", () => ({
  getChapterText: getChapterTextMock,
  listChapterEntityLinks: listChapterEntityLinksMock,
}));

type ExportersModule = typeof import("../../src/modules/studio/exporters");

const baseChapter = {
  id: "chapter-alpha",
  story_id: "story-beta",
  title: "Pilot",
  sort_order: 0,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const baseStory = {
  id: "story-beta",
  title: "Test Story",
  summary: "",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  chapters: [baseChapter],
};

let turndownInstance: { turndown: ReturnType<typeof vi.fn> };

async function importModule(): Promise<ExportersModule> {
  return import("../../src/modules/studio/exporters");
}

beforeEach(() => {
  vi.clearAllMocks();
  createEntityMentionExtensionsMock.mockReturnValue([]);
  listChapterEntityLinksMock.mockResolvedValue([]);
  generateHtmlMock.mockReturnValue("<p>Body</p>");
  getChapterTextMock.mockResolvedValue({ json: JSON.stringify({ type: "doc" }) });
  turndownInstance = {
    turndown: vi.fn().mockImplementation((html: string) => `md::${html}`),
  };
  turndownCtor.mockReturnValue(turndownInstance);
});

describe("export compositor integration", () => {
  it("throws when no chapter text is stored", async () => {
    const exporters = await importModule();
    getChapterTextMock.mockResolvedValueOnce(null);

    await expect(exporters.exportChapter(baseStory, baseChapter, "html")).rejects.toThrow(
      /no saved content/i,
    );
  });

  it("derives filenames per format when exporting stories", async () => {
    const exporters = await importModule();
    const story = {
      ...baseStory,
      title: "Story: Export/Formats",
      chapters: [
        baseChapter,
        { ...baseChapter, id: "chapter-beta", title: "Follow Up", sort_order: 1 },
      ],
    };

    const htmlPayload = await exporters.exportStory(story, "html");
    expect(htmlPayload.filename).toBe("story-export-formats.html");
    expect(htmlPayload.content).toContain("<main class=\"story-export\">");

    const bbcodePayload = await exporters.exportStory(story, "bbcode");
    expect(bbcodePayload.filename).toBe("story-export-formats.bbcode");
    expect(bbcodePayload.content).toContain("[center][size=170]Story: Export/Formats[/size][/center]");
  });
});
