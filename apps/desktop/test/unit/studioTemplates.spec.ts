import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window as unknown as typeof globalThis;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.navigator = dom.window.navigator;
globalThis.MutationObserver = dom.window.MutationObserver;

import type { StudioTemplate } from "../../src/modules/studio/templates";
import { insertTemplateContent } from "../../src/modules/studio/templates/utils";

const createEditor = (content: string) =>
  new Editor({
    extensions: [StarterKit],
    content,
  });

const template: StudioTemplate = {
  id: "unit-test-template",
  title: "Unit Test Template",
  description: "Simple paragraph used to confirm insertion behaviour.",
  content: {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Template Block",
      },
    ],
  },
};

describe("insertTemplateContent", () => {
  it("inserts template nodes without overwriting existing content at the cursor", () => {
    const editor = createEditor("<p>Hello World</p>");
    editor.commands.setTextSelection(1);

    insertTemplateContent(editor, template);

    const text = editor.getText();
    expect(text.includes("Template Block")).toBe(true);
    expect(text.includes("Hello World")).toBe(true);
    expect(text.indexOf("Template Block")).toBeLessThan(text.indexOf("Hello World"));
    editor.destroy();
  });

  it("respects existing prose when inserting mid-document", () => {
    const editor = createEditor("<p>Hello brave new World</p>");
    editor.commands.setTextSelection(12);

    insertTemplateContent(editor, template);

    const text = editor.getText();
    expect(text.includes("Hello brave")).toBe(true);
    expect(text.includes("new World")).toBe(true);
    expect(text.includes("Template Block")).toBe(true);
    editor.destroy();
  });
});
