import type { Editor as TiptapEditor, JSONContent } from "@tiptap/core";

import type { StudioTemplate } from "./index";

const normalizeContent = (content: JSONContent | JSONContent[]): JSONContent[] =>
  Array.isArray(content) ? content : [content];

export const insertTemplateContent = (editor: TiptapEditor, template: StudioTemplate): void => {
  const payload = normalizeContent(template.content);
  if (!editor || payload.length === 0) {
    return;
  }

  editor
    .chain()
    .focus()
    .insertContent(payload.length === 1 ? payload[0] : payload)
    .run();
};
