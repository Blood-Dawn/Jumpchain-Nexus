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

interface NavItem {
  to: string;
  label: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/studio", label: "Story Studio", description: "Write chapters & recaps" },
  { to: "/overview", label: "Overview", description: "Manage jumps & builds" },
  { to: "/passport", label: "Cosmic Passport", description: "Profile & attributes" },
  { to: "/warehouse", label: "Cosmic Warehouse", description: "Configure storage" },
  { to: "/locker", label: "Cosmic Locker", description: "Catalog items" },
  { to: "/drawbacks", label: "Drawback Supplement", description: "Rules & mechanics" },
  { to: "/export", label: "Exports", description: "Share builds & notes" },
  { to: "/stats", label: "Statistics", description: "Totals & analytics" },
  { to: "/options", label: "Options", description: "Defaults & categories" },
  { to: "/formatter", label: "Input Formatter", description: "Clean pasted text" },
  { to: "/randomizer", label: "Jump Randomizer", description: "Weighted selection" },
  { to: "/hub", label: "Jump Memory Hub", description: "Timeline & archives" },
];

export const NavRail: React.FC = () => {
  return (
    <nav className="jmh-nav">
      <h1 className="jmh-nav__title">Jumpchain Nexus</h1>
      <ul className="jmh-nav__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }: { isActive: boolean }) =>
                `jmh-nav__button${isActive ? " jmh-nav__button--active" : ""}`
              }
            >
              <span className="jmh-nav__label">{item.label}</span>
              <span className="jmh-nav__hint">{item.description}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default NavRail;
