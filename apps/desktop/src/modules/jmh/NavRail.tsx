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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { modules, resolveModulePath, sectionLabels, sectionOrder } from "../registry";

const NAV_MODE_STORAGE_KEY = "jmh-nav-mode";

type NavMode = "expanded" | "collapsed";

export const NavRail: React.FC = () => {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(searchValue.trim());
    }, 250);

    return () => {
      window.clearTimeout(handle);
    };
  }, [searchValue]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement) {
          const tagName = activeElement.tagName.toLowerCase();
          if (tagName === "input" || tagName === "textarea" || activeElement.isContentEditable) {
            return;
          }
        }

        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const normalizedQuery = debouncedQuery.toLowerCase();

  const matchesQuery = useCallback(
    (value: string) => {
      if (!normalizedQuery) {
        return true;
      }

      return value.toLowerCase().includes(normalizedQuery);
    },
    [normalizedQuery],
  );

  const sections = useMemo(
    () =>
      sectionOrder
        .map((section) => ({
          section,
          label: sectionLabels[section],
          entries: modules.filter(
            (module) =>
              module.section === section &&
              (matchesQuery(module.title) || matchesQuery(module.description)),
          ),
        }))
        .filter((group) => group.entries.length > 0),
    [matchesQuery],
  );

  const highlightMatch = useCallback(
    (text: string) => {
      if (!debouncedQuery) {
        return text;
      }

      const escapedQuery = debouncedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escapedQuery})`, "ig");
      const segments = text.split(regex);

      return segments.map((segment, index) =>
        index % 2 === 1 ? (
          <mark className="jmh-nav__highlight" key={`${text}-${index}`}>
            {segment}
          </mark>
        ) : (
          segment
        ),
      );
    },
    [debouncedQuery],
  );

  const navClassName = useMemo(() => `jmh-nav${mode === "collapsed" ? " jmh-nav--collapsed" : ""}`, [mode]);

  return (
    <nav className="jmh-nav">
      <h1 className="jmh-nav__title">Jumpchain Nexus</h1>
      <div className="jmh-nav__filter">
        <label className="jmh-nav__filter-label" htmlFor="jmh-nav-filter">
          Filter modules
        </label>
        <input
          ref={inputRef}
          id="jmh-nav-filter"
          className="jmh-nav__filter-input"
          type="search"
          placeholder="Search modules (press /)"
          value={searchValue}
          aria-describedby="jmh-nav-filter-hint"
          onChange={(event) => setSearchValue(event.target.value)}
        />
        <p className="jmh-nav__filter-hint" id="jmh-nav-filter-hint">
          Press <kbd>/</kbd> to focus the filter input.
        </p>
      </div>
      <div className="jmh-nav__sections">
        {sections.map((group) => (
          <section className="jmh-nav__section" key={group.section}>
            <h2 className="jmh-nav__section-title">{group.label}</h2>
            <ul className="jmh-nav__list">
              {group.entries.map((module) => (
                <li key={module.id}>
                  <NavLink
                    to={resolveModulePath(module)}
                    className={({ isActive }: { isActive: boolean }) =>
                      `jmh-nav__button${isActive ? " jmh-nav__button--active" : ""}`
                    }
                    title={module.title}
                    aria-label={module.title}
                  >
                    <span className="jmh-nav__label">{highlightMatch(module.title)}</span>
                    <span className="jmh-nav__hint">{highlightMatch(module.description)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {sections.length === 0 && (
          <p className="jmh-nav__empty" role="status">
            No modules match your search.
          </p>
        )}
      </div>
    </nav>
  );
};

export default NavRail;
