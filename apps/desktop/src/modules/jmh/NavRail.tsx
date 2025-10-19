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

import React from "react";
import { NavLink } from "react-router-dom";
import { modules, resolveModulePath, sectionLabels, sectionOrder } from "../registry";

type NavLinkStyle = React.CSSProperties & { "--module-accent"?: string };

export const NavRail: React.FC = () => {
  const sections = sectionOrder
    .map((section) => ({
      section,
      label: sectionLabels[section],
      entries: modules.filter((module) => module.section === section),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <nav className="jmh-nav">
      <h1 className="jmh-nav__title">Jumpchain Nexus</h1>
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
                    style={
                      module.accent
                        ? ({ "--module-accent": module.accent } as NavLinkStyle)
                        : undefined
                    }
                  >
                    <span className="jmh-nav__label">{module.title}</span>
                    <span className="jmh-nav__hint">{module.description}</span>
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
