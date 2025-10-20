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

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFormatterSettings, type FormatterSettings } from "../../db/dao";
import {
  formatBudget,
  formatInputText,
  THOUSANDS_SEPARATOR_CHOICES,
  type ThousandsSeparatorOption,
} from "../../services/formatter";
import { FORMATTER_PREFERENCES_QUERY_KEY, useFormatterPreferences } from "../../hooks/useFormatterPreferences";
import "./formatter.css";

const SAMPLE_BUDGETS = [1000, 12500, 250000, -4250];

const InputFormatter: React.FC = () => {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [removeAllLineBreaks, setRemoveAllLineBreaks] = useState(false);
  const [leaveDoubleLineBreaks, setLeaveDoubleLineBreaks] = useState(false);
  const [separator, setSeparator] = useState<ThousandsSeparatorOption>("none");
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const formatterPreferencesQuery = useFormatterPreferences();

  useEffect(() => {
    if (!formatterPreferencesQuery.data) {
      return;
    }

    setRemoveAllLineBreaks(formatterPreferencesQuery.data.removeAllLineBreaks);
    setLeaveDoubleLineBreaks(formatterPreferencesQuery.data.leaveDoubleLineBreaks);
    setSeparator(formatterPreferencesQuery.data.thousandsSeparator);
    setSpellcheckEnabled(formatterPreferencesQuery.data.spellcheckEnabled);
  }, [formatterPreferencesQuery.data]);

  const formattingOptions = useMemo(
    () => ({
      removeAllLineBreaks,
      leaveDoubleLineBreaks,
      xmlSafe: true,
    }),
    [removeAllLineBreaks, leaveDoubleLineBreaks]
  );

  const outputText = useMemo(
    () => formatInputText(inputText, formattingOptions),
    [inputText, formattingOptions]
  );

  const metrics = useMemo(() => {
    const inputCharacters = inputText.length;
    const outputCharacters = outputText.length;
    const outputWords = outputText.trim().length ? outputText.trim().split(/\s+/).length : 0;
    const compression = inputCharacters === 0 ? 0 : 1 - outputCharacters / inputCharacters;

    return {
      inputCharacters,
      outputCharacters,
      outputWords,
      compression: Number.isFinite(compression) ? Math.max(Math.min(compression, 1), -1) : 0,
    };
  }, [inputText.length, outputText]);

  const preferencesMutation = useMutation({
    mutationFn: (overrides: Partial<FormatterSettings>) => updateFormatterSettings(overrides),
    onSuccess: (next) => {
      queryClient.setQueryData(FORMATTER_PREFERENCES_QUERY_KEY, next);
      void queryClient.invalidateQueries({ queryKey: FORMATTER_PREFERENCES_QUERY_KEY }).catch(
        () => undefined,
      );
      setStatusMessage("Preferences saved");
    },
    onError: (error) => {
      console.error("Failed to update formatter settings", error);
      setStatusMessage("Failed to save preferences. See console for details.");
    },
  });

  useEffect(() => {
    if (!statusMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const updatePreferences = (overrides: Partial<FormatterSettings>) => {
    preferencesMutation.mutate(overrides);
  };

  const handleToggleSpellcheck = () => {
    const nextSpellcheck = !spellcheckEnabled;
    setSpellcheckEnabled(nextSpellcheck);
    updatePreferences({ spellcheckEnabled: nextSpellcheck });
  };

  const handleToggleRemoveAll = () => {
    const nextRemoveAll = !removeAllLineBreaks;
    const nextLeaveDouble = nextRemoveAll ? false : leaveDoubleLineBreaks;
    setRemoveAllLineBreaks(nextRemoveAll);
    setLeaveDoubleLineBreaks(nextLeaveDouble);
    updatePreferences({
      removeAllLineBreaks: nextRemoveAll,
      leaveDoubleLineBreaks: nextLeaveDouble,
    });
  };

  const handleToggleLeaveDouble = () => {
    const nextLeaveDouble = !leaveDoubleLineBreaks;
    const nextRemoveAll = nextLeaveDouble ? false : removeAllLineBreaks;
    setLeaveDoubleLineBreaks(nextLeaveDouble);
    setRemoveAllLineBreaks(nextRemoveAll);
    updatePreferences({
      leaveDoubleLineBreaks: nextLeaveDouble,
      removeAllLineBreaks: nextRemoveAll,
    });
  };

  const handleSeparatorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ThousandsSeparatorOption;
    setSeparator(value);
    updatePreferences({ thousandsSeparator: value });
  };

  const clipboardAvailable = typeof navigator !== "undefined" && Boolean(navigator.clipboard);

  const handlePaste = async () => {
    if (!clipboardAvailable) {
      setStatusMessage("Clipboard is unavailable in this environment.");
      return;
    }
    try {
      const pasted = await navigator.clipboard.readText();
      if (pasted) {
        setInputText(pasted);
      }
    } catch (error) {
      console.error("Failed to read from clipboard", error);
      setStatusMessage("Could not read from clipboard.");
    }
  };

  const handleCopy = async () => {
    if (!clipboardAvailable) {
      setStatusMessage("Clipboard is unavailable in this environment.");
      return;
    }
    try {
      await navigator.clipboard.writeText(outputText);
      setStatusMessage("Formatted text copied to clipboard");
    } catch (error) {
      console.error("Failed to copy to clipboard", error);
      setStatusMessage("Could not copy to clipboard.");
    }
  };

  return (
    <section className="formatter">
      <header className="formatter__header">
        <div>
          <h1>Input Formatter</h1>
          <p>Clean pasted PDF text, repair spacing, and standardise jump budgets.</p>
        </div>
        {statusMessage ? <span className="formatter__status">{statusMessage}</span> : null}
      </header>

      <div className="formatter__preferences">
        <label>
          <input
            type="checkbox"
            checked={spellcheckEnabled}
            onChange={handleToggleSpellcheck}
            disabled={preferencesMutation.isPending}
          />
          Enable spellcheck in editors
        </label>
        <label>
          <input
            type="checkbox"
            checked={removeAllLineBreaks}
            onChange={handleToggleRemoveAll}
            disabled={preferencesMutation.isPending}
          />
          Delete every line break
        </label>
        <label>
          <input
            type="checkbox"
            checked={leaveDoubleLineBreaks}
            onChange={handleToggleLeaveDouble}
            disabled={preferencesMutation.isPending}
          />
          Keep paragraph breaks (double line breaks)
        </label>
        <label className="formatter__separator">
          Thousands separator
          <select
            value={separator}
            onChange={handleSeparatorChange}
            disabled={preferencesMutation.isPending}
          >
            {THOUSANDS_SEPARATOR_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="formatter__layout">
        <section className="formatter__pane formatter__pane--input">
          <header>
            <h2>Raw input</h2>
            <div className="formatter__actions">
              <button type="button" className="ghost" onClick={() => setInputText("")}>
                Clear
              </button>
              <button type="button" onClick={handlePaste} disabled={!clipboardAvailable}>
                Paste from clipboard
              </button>
            </div>
          </header>
          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder="Paste perk text, drawback descriptions, or PDF extractions here."
            rows={18}
            spellCheck={spellcheckEnabled}
          />
          <footer>
            <span>{metrics.inputCharacters} characters</span>
          </footer>
        </section>

        <section className="formatter__pane formatter__pane--output">
          <header>
            <h2>Formatted result</h2>
            <div className="formatter__actions">
              <button type="button" onClick={handleCopy} disabled={!clipboardAvailable || !outputText}>
                Copy formatted text
              </button>
            </div>
          </header>
          {formatterPreferencesQuery.isLoading ? (
            <div className="formatter__loading">Loading preferences…</div>
          ) : formatterPreferencesQuery.isError ? (
            <div className="formatter__loading formatter__loading--error">
              Failed to load formatter preferences.
            </div>
          ) : (
            <textarea value={outputText} readOnly rows={18} spellCheck={spellcheckEnabled} />
          )}
          <footer>
            <span>{metrics.outputCharacters} characters</span>
            <span>{metrics.outputWords} words</span>
            <span>{Math.round(metrics.compression * 100)}% compression</span>
          </footer>
        </section>
      </div>

      <section className="formatter__preview">
        <header>
          <h2>Budget preview</h2>
          <p>
            Formatting honours your thousands separator selection. These samples update whenever you
            change preferences.
          </p>
        </header>
        <ul>
          {SAMPLE_BUDGETS.map((value) => (
            <li key={value}>
              <code>{value}</code>
              <span>{formatBudget(value, separator)}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
};

export default InputFormatter;
