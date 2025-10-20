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

import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { modules, resolveModulePath, sectionLabels, sectionOrder } from "../registry";

const NAV_MODE_STORAGE_KEY = "jmh-nav-mode";

type NavMode = "expanded" | "collapsed";

export const NavRail: React.FC = () => {
  const [mode, setMode] = useState<NavMode>(() => {
    if (typeof window === "undefined") {
      return "expanded";
    }

    const stored = window.localStorage.getItem(NAV_MODE_STORAGE_KEY) as NavMode | null;
    return stored === "collapsed" ? "collapsed" : "expanded";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.jmhNavMode = mode;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(NAV_MODE_STORAGE_KEY, mode);
    }

    return () => {
      if (typeof document !== "undefined" && document.body.dataset.jmhNavMode === mode) {
        delete document.body.dataset.jmhNavMode;
      }
    };
  }, [mode]);

  const toggleMode = () => {
    setMode((current) => (current === "collapsed" ? "expanded" : "collapsed"));
  };

  const sections = sectionOrder
    .map((section) => ({
      section,
      label: sectionLabels[section],
      entries: modules.filter((module) => module.section === section),
    }))
    .filter((group) => group.entries.length > 0);

  const navClassName = useMemo(() => `jmh-nav${mode === "collapsed" ? " jmh-nav--collapsed" : ""}`, [mode]);

  return (
    <nav className={navClassName} aria-label="Primary navigation">
      <div className="jmh-nav__header">
        <h1 className="jmh-nav__title">Jumpchain Nexus</h1>
        <button
          type="button"
          className="jmh-nav__mode-toggle"
          aria-pressed={mode === "collapsed"}
          aria-label={mode === "collapsed" ? "Expand navigation" : "Collapse navigation"}
          title={mode === "collapsed" ? "Expand navigation" : "Collapse navigation"}
          onClick={toggleMode}
        >
          <span aria-hidden="true" className="jmh-nav__mode-toggle-icon">
            {mode === "collapsed" ? "⮜" : "⮞"}
          </span>
        </button>
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
                    <span className="jmh-nav__icon" aria-hidden="true">
                      {(module.icon ?? module.title.charAt(0)).toUpperCase()}
                    </span>
                    <span className="jmh-nav__text">
                      <span className="jmh-nav__label">{module.title}</span>
                      <span className="jmh-nav__hint">{module.description}</span>
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
};

export default NavRail;
