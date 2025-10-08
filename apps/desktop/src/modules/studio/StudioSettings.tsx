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

import React, { useState } from "react";
import { ensureSidecarRunning, shutdownSidecar } from "../../services/grammar";
import { useStudioStore } from "./store";

export const StudioSettings: React.FC = () => {
  const layout = useStudioStore((state) => state.layout);
  const setLayout = useStudioStore((state) => state.setLayout);
  const focusMode = useStudioStore((state) => state.focusMode);
  const setFocusMode = useStudioStore((state) => state.setFocusMode);
  const grammarEnabled = useStudioStore((state) => state.grammarEnabled);
  const setGrammarEnabled = useStudioStore((state) => state.setGrammarEnabled);
  const grammarMode = useStudioStore((state) => state.grammarMode);
  const setGrammarMode = useStudioStore((state) => state.setGrammarMode);
  const autosaveInterval = useStudioStore((state) => state.autosaveIntervalMs);
  const setAutosaveInterval = useStudioStore((state) => state.setAutosaveInterval);

  const [sidecarStatus, setSidecarStatus] = useState<string | null>(null);

  const toggleSidecarMode = async (mode: "remote" | "sidecar") => {
    setGrammarMode(mode);
    if (mode === "sidecar") {
      setSidecarStatus("Starting local LanguageTool service…");
      try {
        const port = await ensureSidecarRunning();
        setSidecarStatus(`Sidecar running on port ${port}`);
      } catch (error) {
        setSidecarStatus("Failed to start sidecar. Check logs.");
        console.error(error);
      }
    } else {
      await shutdownSidecar();
      setSidecarStatus(null);
    }
  };

  return (
    <section className="studio-settings">
      <div className="studio-settings__row">
        <h3>Chapter List Layout</h3>
        <div className="studio-settings__controls">
          <button
            type="button"
            className={layout === "top" ? "jmh-nav__button jmh-nav__button--active" : "jmh-nav__button"}
            onClick={() => setLayout("top")}
          >
            Dock Top
          </button>
          <button
            type="button"
            className={layout === "side" ? "jmh-nav__button jmh-nav__button--active" : "jmh-nav__button"}
            onClick={() => setLayout("side")}
          >
            Dock Side
          </button>
        </div>
      </div>

      <div className="studio-settings__row">
        <h3>Focus Mode</h3>
        <div className="studio-settings__controls">
          <label>
            <input
              type="checkbox"
              checked={focusMode}
              onChange={(event) => setFocusMode(event.target.checked)}
            />
            Hide navigation & chrome while writing
          </label>
        </div>
      </div>

      <div className="studio-settings__row">
        <h3>Grammar Assistant</h3>
        <div className="studio-settings__controls">
          <label>
            <input
              type="checkbox"
              checked={grammarEnabled}
              onChange={(event) => setGrammarEnabled(event.target.checked)}
            />
            Enable suggestions
          </label>
          <label>
            <input
              type="radio"
              value="remote"
              checked={grammarMode === "remote"}
              onChange={() => toggleSidecarMode("remote")}
              disabled={!grammarEnabled}
            />
            LanguageTool Cloud
          </label>
          <label>
            <input
              type="radio"
              value="sidecar"
              checked={grammarMode === "sidecar"}
              onChange={() => toggleSidecarMode("sidecar")}
              disabled={!grammarEnabled}
            />
            Local Sidecar
          </label>
        </div>
        {sidecarStatus && <p className="studio-shell__summary">{sidecarStatus}</p>}
      </div>

      <div className="studio-settings__row">
        <h3>Autosave Interval</h3>
        <div className="studio-settings__controls">
          <input
            type="range"
            min={2000}
            max={15000}
            step={1000}
            value={autosaveInterval}
            onChange={(event) => setAutosaveInterval(Number(event.target.value))}
          />
          <span>{Math.round(autosaveInterval / 1000)}s</span>
        </div>
      </div>
    </section>
  );
};

export default StudioSettings;
