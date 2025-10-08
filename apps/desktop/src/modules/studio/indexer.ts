/*
MIT License

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

import { ChapterRecord } from "../../db/dao";
import {
  clearChapterMentions,
  getStoryById,
  listRecaps,
  recordChapterMention,
  StoryRecord,
  upsertRecap,
} from "../../db/dao";
import { useJmhStore } from "../jmh/store";

export interface ChapterMentionInput {
  entityId: string;
  start: number | null;
  end: number | null;
}

function buildRecapMarkdown(chapter: ChapterRecord, story: StoryRecord, plain: string): string {
  const preview = plain.trim().slice(0, 400);
  const body = preview.length === plain.trim().length ? preview : `${preview}…`;
  return `### ${chapter.title}\n**Story:** ${story.title}${story.jump_id ? ` (Jump: ${story.jump_id})` : ""}\n\n${body}`;
}

export async function syncChapterMetadata(
  chapter: ChapterRecord,
  mentions: ChapterMentionInput[],
  plain: string
): Promise<void> {
  await clearChapterMentions(chapter.id);
  if (mentions.length) {
    await Promise.all(
      mentions.map((mention) =>
        recordChapterMention(chapter.id, mention.entityId, mention.start ?? null, mention.end ?? null)
      )
    );
  }

  const story = await getStoryById(chapter.story_id);
  if (story && story.jump_id) {
    await upsertRecap({
      id: chapter.id,
      jump_id: story.jump_id,
      period: "custom",
      md: buildRecapMarkdown(chapter, story, plain),
    });
    const recaps = await listRecaps();
    useJmhStore.getState().setRecaps(recaps);
  }
}
