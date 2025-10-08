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

import { create } from "zustand";
import type {
  EntityRecord,
  GlobalSearchResults,
  JumpRecord,
  NextActionRecord,
  NoteRecord,
  RecapRecord,
} from "../../db/dao";

export type NavKey =
  | "dashboard"
  | "jumps"
  | "story"
  | "atlas"
  | "imports"
  | "help";

export type TimelineFilter = "all" | "current" | "past" | "future";

export interface JmhState {
  nav: NavKey;
  setNav: (nav: NavKey) => void;
  jumps: JumpRecord[];
  setJumps: (jumps: JumpRecord[]) => void;
  entities: EntityRecord[];
  setEntities: (entities: EntityRecord[]) => void;
  notes: NoteRecord[];
  setNotes: (notes: NoteRecord[]) => void;
  recaps: RecapRecord[];
  setRecaps: (recaps: RecapRecord[]) => void;
  nextActions: NextActionRecord[];
  setNextActions: (actions: NextActionRecord[]) => void;
  selectedJumpId: string | null;
  setSelectedJump: (id: string | null) => void;
  selectedNoteId: string | null;
  setSelectedNote: (id: string | null) => void;
  selectedFileId: string | null;
  setSelectedFile: (id: string | null) => void;
  searchResults: GlobalSearchResults | null;
  setSearchResults: (results: GlobalSearchResults | null) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  timelineFilter: TimelineFilter;
  setTimelineFilter: (filter: TimelineFilter) => void;
  rightPaneMode: "glossary" | "context";
  setRightPaneMode: (mode: "glossary" | "context") => void;
  helpTopic: string;
  setHelpTopic: (topic: string) => void;
  helpPaneOpen: boolean;
  setHelpPaneOpen: (open: boolean) => void;
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
}

export const useJmhStore = create<JmhState>((set) => ({
  nav: "dashboard",
  setNav: (nav) => set({ nav }),
  jumps: [],
  setJumps: (jumps) => set({ jumps }),
  entities: [],
  setEntities: (entities) => set({ entities }),
  notes: [],
  setNotes: (notes) => set({ notes }),
  recaps: [],
  setRecaps: (recaps) => set({ recaps }),
  nextActions: [],
  setNextActions: (actions) => set({ nextActions: actions }),
  selectedJumpId: null,
  setSelectedJump: (selectedJumpId) => set({ selectedJumpId }),
  selectedNoteId: null,
  setSelectedNote: (selectedNoteId) => set({ selectedNoteId }),
  selectedFileId: null,
  setSelectedFile: (selectedFileId) => set({ selectedFileId }),
  searchResults: null,
  setSearchResults: (searchResults) => set({ searchResults }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  timelineFilter: "all",
  setTimelineFilter: (timelineFilter) => set({ timelineFilter }),
  rightPaneMode: "glossary",
  setRightPaneMode: (rightPaneMode) => set({ rightPaneMode }),
  helpTopic: "Origins",
  setHelpTopic: (helpTopic) => set({ helpTopic }),
  helpPaneOpen: true,
  setHelpPaneOpen: (helpPaneOpen) => set({ helpPaneOpen }),
  onboardingComplete: false,
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
}));

export function selectCurrentJump(jumps: JumpRecord[], id: string | null): JumpRecord | null {
  if (!id) return null;
  return jumps.find((jump) => jump.id === id) ?? null;
}

export function selectEntitiesByType(
  entities: EntityRecord[],
  type: EntityRecord["type"],
): EntityRecord[] {
  return entities.filter((entity) => entity.type === type);
}

export function isFutureJump(jump: JumpRecord): boolean {
  if (!jump.start_date) return false;
  const now = new Date().toISOString();
  return jump.start_date > now;
}

export function isPastJump(jump: JumpRecord): boolean {
  if (!jump.end_date) return false;
  const now = new Date().toISOString();
  return jump.end_date < now;
}

export function filterRecapsByTimeline(
  recaps: RecapRecord[],
  jumps: JumpRecord[],
  filter: TimelineFilter,
): RecapRecord[] {
  if (filter === "all") {
    return recaps;
  }

  const lookup = new Map(jumps.map((jump) => [jump.id, jump] as const));
  const now = new Date().toISOString();

  return recaps.filter((recap) => {
    const jump = lookup.get(recap.jump_id);
    if (!jump) return true;
    if (filter === "future") {
      return jump.start_date ? jump.start_date > now : false;
    }
    if (filter === "past") {
      return jump.end_date ? jump.end_date < now : false;
    }
    return !(jump.end_date && jump.end_date < now) && !(jump.start_date && jump.start_date > now);
  });
}

export function sortNextActions(actions: NextActionRecord[]): NextActionRecord[] {
  return [...actions].sort((a, b) => {
    if (!a.due_date && !b.due_date) return a.summary.localeCompare(b.summary);
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}