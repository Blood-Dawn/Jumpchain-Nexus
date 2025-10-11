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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";

const TEST_EVENT = "devtools://test-run";

export type LogLevel = "info" | "warn" | "error";

type LogSource = "stdout" | "stderr";

type LogEntry = {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: LogSource;
};

type RunnerEvent =
  | { kind: "started" }
  | { kind: "log"; level: LogLevel; message: string; source: LogSource }
  | { kind: "terminated"; code: number | null }
  | { kind: "error"; message: string };

const formatTimestamp = (date: Date): string =>
  `${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

const DevToolsTestRunner: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to launch the full test suite.");
  const nextLogId = useRef(1);

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
            setLogs((current) => [...current, entry]);
            return;
          }

          if (payload.kind === "terminated") {
            setIsRunning(false);
            if (payload.code === 0) {
              setStatusMessage("Test suite completed successfully.");
            } else {
              setStatusMessage(
                `Test suite exited with code ${payload.code ?? "unknown"}. Check the log for details.`
              );
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
            setLogs((current) => [...current, entry]);
            setStatusMessage("Failed to stream test output. See the log for details.");
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
  }, []);

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
      setLogs((current) => [...current, entry]);
      setStatusMessage("Unable to launch the test suite. See the log for details.");
    }
  }, []);

  const handleClearLog = useCallback(() => {
    setLogs([]);
  }, []);

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
