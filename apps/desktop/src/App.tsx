/*
MIT License

Copyright (c) 2025 Bloodawn

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
import React, { Suspense } from "react";
import { Navigate, RouterProvider, createHashRouter } from "react-router-dom";
import "./App.css";
import PageLayout from "./components/PageLayout";
import { AppearanceProvider } from "./contexts/AppearanceContext";
import { defaultModule, modules } from "./modules/registry";

const enableBackgroundEffects = import.meta.env.VITE_ENABLE_STARFIELD === "true";

const fallback = <div className="app-loading">Loading module…</div>;

const router = createHashRouter([
  {
    path: "/",
    element: <PageLayout enableBackgroundEffects={enableBackgroundEffects} />,
    children: [
      ...modules.map((module) => ({
        path: module.path,
        element: (
          <Suspense fallback={fallback}>
            <module.element />
          </Suspense>
        ),
      })),
      {
        index: true,
        element: <Navigate to={`/${defaultModule.path}`} replace />,
      },
      {
        path: "*",
        element: <Navigate to={`/${defaultModule.path}`} replace />,
      },
    ],
  },
]);

const App: React.FC = () => {
  return (
    <AppearanceProvider>
      <RouterProvider router={router} />
    </AppearanceProvider>
  );
};

export default App;
