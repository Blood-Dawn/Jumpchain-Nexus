/*
MIT License

Copyright (c) 2025 Age-Of-Ages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

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
import React, { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

const StoryStudio = lazy(async () => import("./modules/studio"));
const JumpMemoryHub = lazy(async () => import("./modules/jmh"));
const JumpchainOverview = lazy(async () => import("./modules/overview"));
const CosmicPassport = lazy(async () => import("./modules/passport"));
const CosmicWarehouse = lazy(async () => import("./modules/warehouse"));
const CosmicLocker = lazy(async () => import("./modules/locker"));
const DrawbackSupplement = lazy(async () => import("./modules/drawbacks"));
const ExportCenter = lazy(async () => import("./modules/export"));
const StatisticsHub = lazy(async () => import("./modules/stats"));
const JumpchainOptions = lazy(async () => import("./modules/options"));
const InputFormatter = lazy(async () => import("./modules/formatter"));
const JumpRandomizer = lazy(async () => import("./modules/randomizer"));

const App: React.FC = () => {
  return (
    <HashRouter>
      <Suspense fallback={<div className="app-loading">Loading module…</div>}>
        <Routes>
          <Route path="/studio" element={<StoryStudio />} />
          <Route path="/overview" element={<JumpchainOverview />} />
          <Route path="/passport" element={<CosmicPassport />} />
          <Route path="/warehouse" element={<CosmicWarehouse />} />
          <Route path="/locker" element={<CosmicLocker />} />
          <Route path="/drawbacks" element={<DrawbackSupplement />} />
          <Route path="/export" element={<ExportCenter />} />
          <Route path="/stats" element={<StatisticsHub />} />
          <Route path="/options" element={<JumpchainOptions />} />
          <Route path="/formatter" element={<InputFormatter />} />
          <Route path="/randomizer" element={<JumpRandomizer />} />
          <Route path="/hub" element={<JumpMemoryHub />} />
          <Route path="/" element={<Navigate to="/studio" replace />} />
          <Route path="*" element={<Navigate to="/studio" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;