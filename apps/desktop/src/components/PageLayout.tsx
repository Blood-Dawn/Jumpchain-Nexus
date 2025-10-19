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

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import NavRail from "../modules/jmh/NavRail";
import StarfieldBackground from "./StarfieldBackground";

interface PageLayoutContextValue {
  setRightPane: (node: React.ReactNode | null) => void;
}

const PageLayoutContext = createContext<PageLayoutContextValue | null>(null);

export const usePageLayout = (): PageLayoutContextValue => {
  const context = useContext(PageLayoutContext);
  if (!context) {
    throw new Error("usePageLayout must be used within PageLayout");
  }
  return context;
};

export const PageLayoutRightPane: React.FC<{ children: React.ReactNode | null }> = ({ children }) => {
  const { setRightPane } = usePageLayout();

  useEffect(() => {
    setRightPane(children ?? null);
    return () => {
      setRightPane(null);
    };
  }, [children, setRightPane]);

  return null;
};

interface PageLayoutProps {
  enableBackgroundEffects?: boolean;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ enableBackgroundEffects }) => {
  const [rightPane, setRightPane] = useState<React.ReactNode | null>(null);

  const contextValue = useMemo<PageLayoutContextValue>(
    () => ({
      setRightPane,
    }),
    [setRightPane]
  );

  return (
    <PageLayoutContext.Provider value={contextValue}>
      <div className="hub-environment">
        {enableBackgroundEffects ? <StarfieldBackground /> : null}
        <div className="hub-shell">
          <NavRail />
          <main className="hub-main">
            <Outlet />
          </main>
          {rightPane}
        </div>
      </div>
    </PageLayoutContext.Provider>
  );
};

export default PageLayout;
