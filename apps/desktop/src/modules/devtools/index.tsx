/*
Bloodawn

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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";
import { getPlatform } from "../../services/platform";

const TEST_EVENT = "devtools://test-run";

export type LogLevel = "info" | "warn" | "error";

type LogSource = "stdout" | "stderr";

export type LogEntry = {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: LogSource;
};

export const LOG_CAP = 500;

const formatLogEntry = (entry: LogEntry): string => {
  const level = entry.level.toUpperCase();
  const source = entry.source.toUpperCase();
  return `[${entry.timestamp}] ${source} ${level}: ${entry.message}`;
};

export const appendLogEntry = (current: LogEntry[], entry: LogEntry): LogEntry[] => {
  const next = [...current, entry];
  if (next.length <= LOG_CAP) {
    return next;
  }
  return next.slice(next.length - LOG_CAP);
};

type RunnerEvent =
  | { kind: "started" }
  | { kind: "log"; level: LogLevel; message: string; source: LogSource }
  | { kind: "terminated"; code: number | null }
  | { kind: "error"; message: string };

type ToastTone = "info" | "success" | "error";

type ToastMessage = {
  id: string;
  tone: ToastTone;
  message: string;
};

const createToastId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return `toast-${counter}`;
  };
})();

const formatTimestamp = (date: Date): string =>
  `${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

const DevToolsTestRunner: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to launch the full test suite.");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextLogId = useRef(1);
  const toastTimers = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = toastTimers.current.get(id);
    if (typeof timer === "number" && typeof window !== "undefined") {
      window.clearTimeout(timer);
    }
    toastTimers.current.delete(id);
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = createToastId();
      setToasts((current) => [...current, { id, message, tone }]);
      if (typeof window !== "undefined") {
        const timeout = window.setTimeout(() => removeToast(id), 3200);
        toastTimers.current.set(id, timeout);
      }
    },
    [removeToast]
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        for (const timer of toastTimers.current.values()) {
          window.clearTimeout(timer);
        }
      }
      toastTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let isMounted = true;

    const register = async () => {
      try {
        unlisten = await listen<RunnerEvent>(TEST_EVENT, (event: Event<RunnerEvent>) => {
          if (!isMounted) {
            return;
          }

          const payload = event.payload;
          if (!payload) {
            return;
          }

          if (payload.kind === "started") {
            setIsRunning(true);
            setStatusMessage("Running npm run test:full…");
            return;
          }

          if (payload.kind === "log") {
            const entry: LogEntry = {
              id: nextLogId.current++,
              level: payload.level,
              message: payload.message,
              source: payload.source,
              timestamp: formatTimestamp(new Date()),
            };
            setLogs((current) => appendLogEntry(current, entry));
            return;
          }

          if (payload.kind === "terminated") {
            setIsRunning(false);
            if (payload.code === 0) {
              const message = "Test suite completed successfully.";
              setStatusMessage(message);
              showToast(message, "success");
            } else {
              const message = `Test suite exited with code ${payload.code ?? "unknown"}. Check the log for details.`;
              setStatusMessage(message);
              showToast("Test suite failed. Check the log for details.", "error");
            }
            return;
          }

          if (payload.kind === "error") {
            setIsRunning(false);
            const entry: LogEntry = {
              id: nextLogId.current++,
              level: "error",
              message: payload.message,
              source: "stderr",
              timestamp: formatTimestamp(new Date()),
            };
            setLogs((current) => appendLogEntry(current, entry));
            setStatusMessage("Failed to stream test output. See the log for details.");
            showToast("Failed to stream test output.", "error");
          }
        });
      } catch (error) {
        console.error("Failed to register test runner listener", error);
      }
    };

    register();

    return () => {
      isMounted = false;
      if (unlisten) {
        void unlisten();
      }
    };
  }, [showToast]);

  const handleRun = useCallback(async () => {
    setStatusMessage("Requesting npm run test:full…");
    try {
      await invoke("run_full_test_suite");
    } catch (error) {
      setIsRunning(false);
      const message = error instanceof Error ? error.message : String(error);
      const entry: LogEntry = {
        id: nextLogId.current++,
        level: "error",
        message,
        source: "stderr",
        timestamp: formatTimestamp(new Date()),
      };
      setLogs((current) => appendLogEntry(current, entry));
      setStatusMessage("Unable to launch the test suite. See the log for details.");
      showToast("Unable to launch the test suite.", "error");
    }
  }, [showToast]);

  const handleCancel = useCallback(async () => {
    setStatusMessage("Requesting cancellation…");
    try {
      await invoke("cancel_full_test_suite");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const entry: LogEntry = {
        id: nextLogId.current++,
        level: "error",
        message,
        source: "stderr",
        timestamp: formatTimestamp(new Date()),
      };
      setLogs((current) => [...current, entry]);
      setStatusMessage("Unable to cancel the test suite. See the log for details.");
      showToast("Unable to cancel the test suite.", "error");
    }
  }, [showToast]);

  const handleClearLog = useCallback(() => {
    setLogs([]);
  }, []);

  const handleDownloadLog = useCallback(async () => {
    if (logs.length === 0) {
      return;
    }

    try {
      const platform = await getPlatform();
      const defaultName = `test-run-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
      const targetPath = await platform.dialog.saveFile({
        title: "Save test run log",
        defaultPath: defaultName,
      });

      if (!targetPath) {
        return;
      }

      setStatusMessage("Saving log output to disk…");
      const payload = logs.map(formatLogEntry).join("\n");
      await platform.fs.writeTextFile(targetPath, payload);
      setStatusMessage("Log saved to disk.");
    } catch (error) {
      console.error("Failed to export log output", error);
      setStatusMessage("Failed to export log output. See the console for details.");
    }
  }, [logs]);

  const runningHint = useMemo(() => {
    if (isRunning) {
      return "Test suite is currently running.";
    }
    if (logs.length === 0) {
      return "No log output captured yet.";
    }
    return "Review the captured log output below.";
  }, [isRunning, logs.length]);

  return (
    <section className="module devtools" aria-labelledby="devtools-runner-heading">
      <header className="module__header">
        <h1 id="devtools-runner-heading">Developer Tools</h1>
        <p className="module__subtitle">
          Launch the full integration test suite without leaving the desktop application.
        </p>
      </header>

      <div className="module__toolbar" role="group" aria-label="Test suite controls">
        <button type="button" className="button" onClick={handleRun} disabled={isRunning}>
          Run npm run test:full
        </button>
        <button type="button" className="button button--secondary" onClick={handleClearLog}>
          Clear log
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={handleDownloadLog}
          disabled={logs.length === 0}
        >
          Download log
        </button>
      </div>

      <div className="module__status" aria-live="polite">
        <p>{statusMessage}</p>
        <p className="module__hint">{runningHint}</p>
      </div>

      <div className="module__log" role="log" aria-live="polite" aria-busy={isRunning}>
        {logs.length === 0 ? (
          <p className="module__hint">Logs will appear here once the test suite produces output.</p>
        ) : (
          <ul className="module__log-list">
            {logs.map((entry) => (
              <li key={entry.id} className={`module__log-entry module__log-entry--${entry.level}`}>
                <span className="module__log-timestamp">[{entry.timestamp}]</span>{" "}
                <span className="module__log-source">{entry.source.toUpperCase()}</span>:
                <span className="module__log-message"> {entry.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default DevToolsTestRunner;

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ToastViewport: React.FC<ToastViewportProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <span>{toast.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
