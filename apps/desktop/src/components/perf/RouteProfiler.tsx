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

import React, { Profiler, useCallback, useEffect } from "react";
import type { ProfilerOnRenderCallback } from "react";

const renderCounts = new Map<string, number>();
const LONG_TASK_THRESHOLD_MS = 50;
const VERBOSE_RENDER_THRESHOLD_MS = 16;

const noopObserverDisconnect = () => undefined;

const createLongTaskObserver = (id: string): (() => void) => {
  if (!import.meta.env.DEV) {
    return noopObserverDisconnect;
  }
  if (typeof PerformanceObserver === "undefined" || typeof window === "undefined") {
    return noopObserverDisconnect;
  }
  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration >= LONG_TASK_THRESHOLD_MS) {
          const duration = Number(entry.duration.toFixed(2));
          // eslint-disable-next-line no-console -- dev-time diagnostics only
          console.warn(`[Perf][${id}] long task detected`, {
            duration,
            name: entry.name,
            startTime: Number(entry.startTime.toFixed(2)),
          });
        }
      });
    });
    observer.observe({ type: "longtask", buffered: true });
    return () => observer.disconnect();
  } catch (error) {
    // eslint-disable-next-line no-console -- dev-time diagnostics only
    console.debug(`[Perf][${id}] long-task observer unavailable`, error);
    return noopObserverDisconnect;
  }
};

interface RouteProfilerProps {
  id: string;
  children: React.ReactNode;
}

export const RouteProfiler: React.FC<RouteProfilerProps> = ({ id, children }) => {
  useEffect(() => createLongTaskObserver(id), [id]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return () => undefined;
    }
    return () => {
      const totalRenders = renderCounts.get(id) ?? 0;
      if (totalRenders > 0) {
        // eslint-disable-next-line no-console -- dev-time diagnostics only
        console.debug(`[Perf][${id}] total renders`, totalRenders);
      }
    };
  }, [id]);

  const handleRender = useCallback<ProfilerOnRenderCallback>(
    (profilerId, phase, actualDuration, baseDuration, startTime, commitTime) => {
      if (!import.meta.env.DEV) {
        return;
      }
      const nextCount = (renderCounts.get(profilerId) ?? 0) + 1;
      renderCounts.set(profilerId, nextCount);
      if (typeof performance !== "undefined" && "mark" in performance) {
        try {
          performance.mark(`${profilerId}-render-${nextCount}`);
        } catch {
          // ignore mark failures (e.g., quota exceeded)
        }
      }
      if (actualDuration >= VERBOSE_RENDER_THRESHOLD_MS || phase === "mount" || nextCount <= 3) {
        const payload = {
          phase,
          actualDuration: Number(actualDuration.toFixed(2)),
          baseDuration: Number(baseDuration.toFixed(2)),
          startTime: Number(startTime.toFixed(2)),
          commitTime: Number(commitTime.toFixed(2)),
          renderCount: nextCount,
        };
        // eslint-disable-next-line no-console -- dev-time diagnostics only
        console.debug(`[Perf][${profilerId}] render`, payload);
      }
    },
    [],
  );

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
};

RouteProfiler.displayName = "RouteProfiler";
