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
import { useJmhStore, type NavKey } from "./store";

interface NavItem {
  key: NavKey;
  label: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", description: "Timeline + recap" },
  { key: "jumps", label: "Jumps", description: "Manage jump cards" },
  { key: "story", label: "Story Studio", description: "Notes & mentions" },
  { key: "atlas", label: "Atlas", description: "Entity glossary" },
  { key: "imports", label: "Imports", description: "PDFs & files" },
  { key: "help", label: "Help", description: "Guides & glossary" },
];

export const NavRail: React.FC = () => {
  const nav = useJmhStore((state) => state.nav);
  const setNav = useJmhStore((state) => state.setNav);

  return (
    <nav className="jmh-nav">
      <h1 className="jmh-nav__title">Jumpchain Nexus</h1>
      <ul className="jmh-nav__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`jmh-nav__button${nav === item.key ? " jmh-nav__button--active" : ""}`}
              onClick={() => setNav(item.key)}
            >
              <span className="jmh-nav__label">{item.label}</span>
              <span className="jmh-nav__hint">{item.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default NavRail;
