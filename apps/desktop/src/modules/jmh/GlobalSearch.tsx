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

import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { globalSearch } from "../../db/dao";
import { useJmhStore } from "./store";

export const GlobalSearch: React.FC = () => {
  const [term, setTerm] = useState("");
  const nav = useJmhStore((state) => state.nav);
  const setNav = useJmhStore((state) => state.setNav);
  const setSearchResults = useJmhStore((state) => state.setSearchResults);
  const searchResults = useJmhStore((state) => state.searchResults);
  const searchOpen = useJmhStore((state) => state.searchOpen);
  const setSearchOpen = useJmhStore((state) => state.setSearchOpen);
  const setSelectedNote = useJmhStore((state) => state.setSelectedNote);
  const setSelectedJump = useJmhStore((state) => state.setSelectedJump);
  const setSelectedFile = useJmhStore((state) => state.setSelectedFile);

  const mutation = useMutation({
    mutationFn: globalSearch,
    onSuccess: (data) => {
      setSearchResults(data);
      setSearchOpen(true);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!term.trim()) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }
    mutation.mutate(term.trim());
  };

  const handleClear = () => {
    setTerm("");
    setSearchResults(null);
    setSearchOpen(false);
  };

  return (
    <div className="jmh-search">
      <form onSubmit={handleSubmit} className="jmh-search__form">
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search notes, PDFs, and entities"
        />
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Searching…" : "Search"}
        </button>
        {term && (
          <button type="button" className="jmh-search__clear" onClick={handleClear}>
            Clear
          </button>
        )}
      </form>

      {searchOpen && searchResults && (
        <div className="jmh-search__results">
          <ResultGroup
            title="Notes"
            items={searchResults.notes}
            EmptyFallback="No notes match that query."
            onSelect={(item) => {
              setSelectedNote(item.id);
              if (item.jump_id) {
                setSelectedJump(item.jump_id);
              }
              if (nav !== "story") setNav("story");
              setSearchOpen(false);
            }}
          />
          <ResultGroup
            title="PDFs"
            items={searchResults.files}
            EmptyFallback="No indexed PDFs yet."
            onSelect={(item) => {
              setSelectedFile(item.id);
              if (item.jump_id) {
                setSelectedJump(item.jump_id);
              }
              if (nav !== "imports") setNav("imports");
              setSearchOpen(false);
            }}
          />
          <ResultGroup
            title="Entities"
            items={searchResults.entities}
            EmptyFallback="No entities matched."
            onSelect={(_item) => {
              setSelectedNote(null);
              setSelectedFile(null);
              if (nav !== "atlas") setNav("atlas");
              setSearchOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

interface ResultGroupProps {
  title: string;
  items: Array<{
    id: string;
    title: string;
    snippet: string;
    score: number;
    jump_id?: string | null;
  }>;
  EmptyFallback: string;
  onSelect: (item: ResultGroupProps["items"][number]) => void;
}

const ResultGroup: React.FC<ResultGroupProps> = ({ title, items, EmptyFallback, onSelect }) => {
  return (
    <section className="jmh-search__group">
      <header>
        <h2>{title}</h2>
      </header>
      {items.length === 0 ? (
        <p className="jmh-search__empty">{EmptyFallback}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item)}>
                <strong>{item.title}</strong>
                <span>{item.snippet || "No preview available"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
