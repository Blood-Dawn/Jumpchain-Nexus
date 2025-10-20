/*
Bloodawn

Copyright (c) 2025 Age-Of-Ages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to do so, subject to the
following conditions:

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

import Mention from "@tiptap/extension-mention";
import type { Editor } from "@tiptap/core";
import type { EntityRecord } from "../../db/dao";

type MentionChar = "@" | "#" | "&";

type MentionKind = Extract<EntityRecord["type"], "perk" | "item" | "companion">;

const MENTION_MAP: Record<MentionChar, MentionKind> = {
  "@": "perk",
  "#": "item",
  "&": "companion",
};

export interface MentionOptions {
  getEntities: () => EntityRecord[];
}

interface MentionOption {
  id: string;
  label: string;
  entityId: string;
  entityType: MentionKind;
}

function insertMention(
  editor: Editor,
  range: { from: number; to: number },
  option: MentionOption,
  name: string,
  char: MentionChar,
) {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      {
        type: name,
        attrs: {
          id: option.entityId,
          entityId: option.entityId,
          entityType: option.entityType,
          label: option.label,
          char,
        },
      },
    ])
    .run();
}

export function createEntityMentionExtensions(options: MentionOptions) {
  return (Object.keys(MENTION_MAP) as MentionChar[]).map((char) => {
    const kind = MENTION_MAP[char];
    const extensionName = `${kind}Mention`;
    return Mention.extend({
      name: extensionName,
      addAttributes() {
        return {
          entityId: {
            default: "",
          },
          entityType: {
            default: kind,
          },
          label: {
            default: "",
          },
          char: {
            default: char,
          },
        };
      },
      renderHTML({ node }) {
        const attrs = node.attrs as {
          entityId?: string;
          entityType?: string;
          label?: string;
          char?: string;
        };
        const symbol = (attrs.char as MentionChar | undefined) ?? char;
        return [
          "span",
          {
            class: "mention",
            "data-entity-id": attrs.entityId,
            "data-entity-type": attrs.entityType,
          },
          `${symbol}${attrs.label ?? attrs.entityId ?? "entity"}`,
        ];
      },
    }).configure({
      suggestion: {
        char,
        items: ({ query }) => {
          const pool = options
            .getEntities()
            .filter((entity) => entity.type === kind);
          const normalized = query.trim().toLowerCase();
          return pool
            .filter((entity) => entity.name.toLowerCase().includes(normalized))
            .slice(0, 12)
            .map<MentionOption>((entity) => ({
              id: entity.id,
              label: entity.name,
              entityId: entity.id,
              entityType: entity.type as MentionKind,
            }));
        },
        command: ({ editor, range, props }) => {
          const option = props as MentionOption;
          insertMention(editor, range, option, extensionName, char);
        },
      },
    });
  });
}
