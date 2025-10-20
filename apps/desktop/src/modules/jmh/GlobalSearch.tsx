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

import { useMutation } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch } from "../../db/dao";
import type { RankedSearchResult } from "../../db/dao";
import { useJmhStore } from "./store";
import { useStudioStore } from "../studio/store";

const SOURCE_META: Record<
  RankedSearchResult["source"],
  { icon: string; label: string; emptyTitle: string; emptyDescription: string }
> = {
  chapter: {
    icon: "📘",
    label: "Chapter",
    emptyTitle: "No chapters found",
    emptyDescription: "Try different keywords or explore another story.",
  },
  note: {
    icon: "📝",
    label: "Note",
    emptyTitle: "No notes match your search",
    emptyDescription: "Search by jump name, tags, or add a new note to the hub.",
  },
  file: {
    icon: "📄",
    label: "PDF",
    emptyTitle: "No PDFs indexed yet",
    emptyDescription: "Upload a PDF to the archive or broaden your search scope.",
  },
  entity: {
    icon: "🧠",
    label: "Entity",
    emptyTitle: "No entities discovered",
    emptyDescription: "Check your spelling or explore another topic.",
  },
};

export const GlobalSearch: React.FC = () => {
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeSelection, setActiveSelection] = useState<SelectionState | null>(null);
  const setSearchResults = useJmhStore((state) => state.setSearchResults);
  const searchResults = useJmhStore((state) => state.searchResults);
  const searchOpen = useJmhStore((state) => state.searchOpen);
  const setSearchOpen = useJmhStore((state) => state.setSearchOpen);
  const setSelectedNote = useJmhStore((state) => state.setSelectedNote);
  const setSelectedJump = useJmhStore((state) => state.setSelectedJump);
  const setSelectedFile = useJmhStore((state) => state.setSelectedFile);
  const navigate = useNavigate();

  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const platform = navigator.platform ?? navigator.userAgent;
    return /Mac|iPhone|iPad|iPod/i.test(platform);
  }, []);

  const focusInput = useCallback(() => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, []);

  const closePalette = useCallback(() => {
    setSearchOpen(false);
    setSearchResults(null);
    setTerm("");
    setActiveSelection(null);
  }, [setSearchOpen, setSearchResults]);

  const openResult = (item: RankedSearchResult | null) => {
    if (!item) return;
    if (item.source === "note") {
      setSelectedNote(item.id);
      setSelectedFile(null);
      if (item.jump_id) {
        setSelectedJump(item.jump_id);
      }
      navigate("/hub");
      closePalette();
      return;
    }
    if (item.source === "file") {
      setSelectedFile(item.id);
      setSelectedNote(null);
      if (item.jump_id) {
        setSelectedJump(item.jump_id);
      }
      navigate("/hub");
      closePalette();
      return;
    }
    if (item.source === "chapter") {
      const studio = useStudioStore.getState();
      if (item.story_id) {
        studio.selectStory(item.story_id);
      }
      studio.selectChapter(item.id);
      setSelectedNote(null);
      setSelectedFile(null);
      navigate("/studio");
      closePalette();
      return;
    }
    setSelectedNote(null);
    setSelectedFile(null);
    navigate("/hub");
    closePalette();
  };

  const mutation = useMutation({
    mutationFn: globalSearch,
    onSuccess: (data) => {
      setSearchResults(data);
      setSearchOpen(true);
    },
  });

  const resultGroups = useMemo(() => {
    if (!searchResults) {
      return [] as ResultGroupShape[];
    }
    return [
      {
        title: "Chapters",
        items: searchResults.chapters,
        empty: (
          <ResultGroupEmpty
            variant="chapter"
            icon={SOURCE_META.chapter.icon}
            title={SOURCE_META.chapter.emptyTitle}
            description={SOURCE_META.chapter.emptyDescription}
          />
        ),
      },
      {
        title: "Notes",
        items: searchResults.notes,
        empty: (
          <ResultGroupEmpty
            variant="note"
            icon={SOURCE_META.note.icon}
            title={SOURCE_META.note.emptyTitle}
            description={SOURCE_META.note.emptyDescription}
          />
        ),
      },
      {
        title: "PDFs",
        items: searchResults.files,
        empty: (
          <ResultGroupEmpty
            variant="file"
            icon={SOURCE_META.file.icon}
            title={SOURCE_META.file.emptyTitle}
            description={SOURCE_META.file.emptyDescription}
          />
        ),
      },
      {
        title: "Entities",
        items: searchResults.entities,
        empty: (
          <ResultGroupEmpty
            variant="entity"
            icon={SOURCE_META.entity.icon}
            title={SOURCE_META.entity.emptyTitle}
            description={SOURCE_META.entity.emptyDescription}
          />
        ),
      },
    ];
  }, [searchResults]);

  const flattenedResults = useMemo(() => {
    const entries: SelectionState[] = [];
    resultGroups.forEach((group, groupIndex) => {
      group.items.forEach((item, itemIndex) => {
        entries.push({
          groupIndex,
          itemIndex,
        });
      });
    });
    return entries;
  }, [resultGroups]);

  useEffect(() => {
    if (!searchResults || flattenedResults.length === 0) {
      setActiveSelection(null);
      return;
    }
    setActiveSelection({
      groupIndex: flattenedResults[0].groupIndex,
      itemIndex: flattenedResults[0].itemIndex,
    });
  }, [searchResults, flattenedResults]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!term.trim()) {
      setSearchResults(null);
      setActiveSelection(null);
      return;
    }
    mutation.mutate(term.trim());
  };

  const handleClear = () => {
    setTerm("");
    setSearchResults(null);
    setActiveSelection(null);
  };

  const moveSelection = useCallback(
    (delta: number) => {
      if (flattenedResults.length === 0) return;
      const currentIndex = flattenedResults.findIndex(
        (entry) =>
          entry.groupIndex === activeSelection?.groupIndex && entry.itemIndex === activeSelection?.itemIndex,
      );
      const normalizedIndex = currentIndex === -1 ? (delta > 0 ? -1 : 0) : currentIndex;
      const nextIndex = (normalizedIndex + delta + flattenedResults.length) % flattenedResults.length;
      const next = flattenedResults[nextIndex];
      setActiveSelection({ groupIndex: next.groupIndex, itemIndex: next.itemIndex });
    },
    [activeSelection, flattenedResults],
  );

  const handleHotkeyOpen = useCallback(() => {
    setSearchOpen(true);
    setSearchResults(null);
    setActiveSelection(null);
    focusInput();
  }, [focusInput, setSearchOpen, setSearchResults]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isEditable = target?.isContentEditable;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key?.toLowerCase?.() ?? "";
      const code = event.code?.toLowerCase?.() ?? "";
      if (modifier && (key === "k" || code === "keyk")) {
        if (tagName === "INPUT" || tagName === "TEXTAREA" || isEditable) {
          return;
        }
        event.preventDefault();
        handleHotkeyOpen();
        return;
      }
      if (event.key === "Escape" && useJmhStore.getState().searchOpen) {
        event.preventDefault();
        closePalette();
      }
    };

    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [closePalette, handleHotkeyOpen]);

  useEffect(() => {
    if (searchOpen) {
      focusInput();
    }
  }, [focusInput, searchOpen]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
      return;
    }
    if (event.key === "Enter") {
      if (event.target instanceof HTMLInputElement && (!searchResults || mutation.isPending)) {
        return;
      }
      const active = activeSelection
        ? resultGroups[activeSelection.groupIndex]?.items[activeSelection.itemIndex] ?? null
        : null;
      if (active) {
        event.preventDefault();
        openResult(active);
      }
    }
  };

  const handleTermChange = (value: string) => {
    setTerm(value);
    if (searchResults) {
      setSearchResults(null);
      setActiveSelection(null);
    }
  };

  const activeItemId = useMemo(() => {
    if (!activeSelection) return null;
    const group = resultGroups[activeSelection.groupIndex];
    if (!group) return null;
    const item = group.items[activeSelection.itemIndex];
    if (!item) return null;
    return `global-search-${item.id}`;
  }, [activeSelection, resultGroups]);

  return (
    <div className="jmh-search">
      <button
        type="button"
        className="jmh-search__trigger"
        onClick={handleHotkeyOpen}
        aria-haspopup="dialog"
      >
        <span>Search the hub</span>
        <kbd>{isMac ? "⌘" : "Ctrl"}K</kbd>
      </button>

      {searchOpen && (
        <div className="jmh-search__overlay" role="presentation" onClick={closePalette}>
          <div
            className="jmh-search__dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <form onSubmit={handleSubmit} className="jmh-search__form">
              <input
                ref={inputRef}
                type="search"
                value={term}
                onChange={(event) => handleTermChange(event.target.value)}
                placeholder="Search chapters, notes, PDFs, and entities"
                aria-controls={searchResults ? "jmh-search-results" : undefined}
              />
              <div className="jmh-search__actions">
                {term && (
                  <button type="button" className="jmh-search__clear" onClick={handleClear}>
                    Clear
                  </button>
                )}
                <button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Searching…" : "Search"}
                </button>
              </div>
            </form>

            {!searchResults && !mutation.isPending && (
              <p className="jmh-search__hint" role="status">
                Type a query to search chapters, notes, PDFs, and entities.
              </p>
            )}
            {mutation.isPending && (
              <p className="jmh-search__hint" role="status">
                Searching the archive…
              </p>
            )}

            {searchResults && (
              <div
                className="jmh-search__results"
                id="jmh-search-results"
                role="listbox"
                aria-activedescendant={activeItemId ?? undefined}
              >
                {resultGroups.map((group, groupIndex) => (
                  <ResultGroup
                    key={group.title}
                    title={group.title}
                    items={group.items}
                    EmptyFallback={group.empty}
                    onSelect={openResult}
                    onHighlight={(itemIndex) =>
                      setActiveSelection({ groupIndex, itemIndex })
                    }
                    activeIndex={
                      activeSelection?.groupIndex === groupIndex ? activeSelection.itemIndex : null
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ResultGroupProps {
  title: string;
  items: RankedSearchResult[];
  EmptyFallback: React.ReactNode;
  onSelect: (item: RankedSearchResult) => void;
  onHighlight: (index: number) => void;
  activeIndex: number | null;
}

const ResultGroup: React.FC<ResultGroupProps> = ({
  title,
  items,
  EmptyFallback,
  onSelect,
  onHighlight,
  activeIndex,
}) => {
  return (
    <section className="jmh-search__group" aria-label={title}>
      <header>
        <h2>{title}</h2>
      </header>
      {items.length === 0 ? (
        EmptyFallback
      ) : (
        <ul role="group" aria-label={title}>
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const optionId = `global-search-${item.id}`;
            const sourceMeta = SOURCE_META[item.source];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={isActive ? "jmh-search__result jmh-search__result--active" : "jmh-search__result"}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => onHighlight(index)}
                  onFocus={() => onHighlight(index)}
                  role="option"
                  aria-selected={isActive}
                  id={optionId}
                >
                  <div className="jmh-search__result-top">
                    <span className={`jmh-search__source-chip jmh-search__source-chip--${item.source}`}>
                      <span className="jmh-search__source-icon" aria-hidden="true">
                        {sourceMeta.icon}
                      </span>
                      <span className="jmh-search__source-text">{sourceMeta.label}</span>
                    </span>
                    <strong className="jmh-search__result-title">{item.title}</strong>
                  </div>
                  <span className="jmh-search__result-snippet">
                    {item.snippet || "No preview available"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

interface ResultGroupShape {
  title: string;
  items: RankedSearchResult[];
  empty: React.ReactNode;
}

interface SelectionState {
  groupIndex: number;
  itemIndex: number;
}

interface ResultGroupEmptyProps {
  variant: RankedSearchResult["source"];
  icon: string;
  title: string;
  description: string;
}

function ResultGroupEmpty({ variant, icon, title, description }: ResultGroupEmptyProps) {
  return (
    <div
      className={`jmh-search__empty jmh-search__empty--${variant}`}
      role="status"
      aria-live="polite"
    >
      <span className="jmh-search__empty-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="jmh-search__empty-copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

