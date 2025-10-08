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

import {
  createJump,
  upsertEntity,
  upsertNextAction,
  upsertNote,
  type EntityKind,
} from "../../db/dao";

export interface OnboardingPayload {
  universeName: string;
  jumpTitle: string;
  origin: string;
  perks: string[];
  premiseLines: string[];
}

function normalizeLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

export async function runOnboarding(payload: OnboardingPayload) {
  const jump = await createJump({
    title: payload.jumpTitle,
    world: payload.universeName,
    start_date: new Date().toISOString(),
    end_date: null,
    status: "planned",
  });

  const mentionablePerks = normalizeLines(payload.perks);
  for (const name of mentionablePerks) {
    await upsertEntity({
      id: crypto.randomUUID(),
      type: "perk" satisfies EntityKind,
      name,
      meta_json: null,
      search_terms: payload.jumpTitle,
    });
  }

  const premise = normalizeLines(payload.premiseLines);
  if (premise.length) {
    const md = `# ${payload.jumpTitle}\n\n**Origin:** ${payload.origin}\n\n${premise
      .map((line) => `- ${line}`)
      .join("\n")}`;
    await upsertNote({
      id: crypto.randomUUID(),
      jump_id: jump.id,
      md,
    });
  }

  await upsertNextAction({
    id: crypto.randomUUID(),
    jump_id: jump.id,
    summary: `Plan first steps for ${payload.jumpTitle}`,
    due_date: null,
  });

  return jump;
}
