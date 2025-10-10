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
  ensureInitialized,
  listAllNotes,
  listEntities,
  listJumpAssets,
  listJumps,
  listNextActions,
  listRecaps,
  type EntityRecord,
  type JumpAssetRecord,
  type JumpRecord,
  type NextActionRecord,
  type NoteRecord,
  type RecapRecord,
} from "../../db/dao";
import { mergeEntitiesWithAssets } from "./assetUtils";

export interface JmhSnapshot {
  jumps: JumpRecord[];
  entities: EntityRecord[];
  notes: NoteRecord[];
  recaps: RecapRecord[];
  nextActions: NextActionRecord[];
}

export async function loadSnapshot(): Promise<JmhSnapshot> {
  await ensureInitialized();
  const [jumps, baseEntities, notes, recaps, nextActions] = await Promise.all([
    listJumps(),
    listEntities(),
    listAllNotes(),
    listRecaps(),
    listNextActions(),
  ]);

  let jumpAssets: JumpAssetRecord[] = [];
  if (jumps.length > 0) {
    const assetGroups = await Promise.all(jumps.map((jump) => listJumpAssets(jump.id)));
    jumpAssets = assetGroups.flat();
  }

  const entities = mergeEntitiesWithAssets(baseEntities, jumpAssets);

  return { jumps, entities, notes, recaps, nextActions };
}
