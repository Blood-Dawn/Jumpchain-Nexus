/*
Bloodawn

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

type IconProps = React.SVGProps<SVGSVGElement>;

const IconBase: React.FC<IconProps> = ({ children, ...props }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

const SpellcheckIcon: React.FC = () => (
  <IconBase>
    <path d="M4 6h9" stroke="currentColor" />
    <path d="M4 10h7" stroke="currentColor" />
    <path d="M4 14h6" stroke="currentColor" />
    <path d="M14 14l3 3 4-5" stroke="currentColor" />
  </IconBase>
);

const RemoveBreaksIcon: React.FC = () => (
  <IconBase>
    <path d="M5 6h14" stroke="currentColor" />
    <path d="M5 10h14" stroke="currentColor" />
    <path d="M5 14h9" stroke="currentColor" />
    <path d="M16.5 16.5l3 3m0-3l-3 3" stroke="currentColor" />
  </IconBase>
);

const KeepParagraphsIcon: React.FC = () => (
  <IconBase>
    <path d="M5 6h14" stroke="currentColor" />
    <path d="M5 10h14" stroke="currentColor" />
    <path d="M9 14v6" stroke="currentColor" />
    <path d="M15 14v6" stroke="currentColor" />
  </IconBase>
);

const SeparatorIcon: React.FC = () => (
  <IconBase>
    <path d="M5 8h14" stroke="currentColor" />
    <path d="M5 16h14" stroke="currentColor" />
    <circle cx="9" cy="12" r="1.2" stroke="currentColor" />
    <circle cx="15" cy="12" r="1.2" stroke="currentColor" />
  </IconBase>
);

const BudgetIcon: React.FC = () => (
  <IconBase>
    <circle cx="9.5" cy="12" r="4" stroke="currentColor" />
    <path d="M13.5 8h6v8h-6" stroke="currentColor" />
    <path d="M8 12h3" stroke="currentColor" />
  </IconBase>
);

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

  const preferenceToggles = [
    {
      key: "spellcheck",
      label: "Enable spellcheck in editors",
      checked: spellcheckEnabled,
      onChange: handleToggleSpellcheck,
      icon: <SpellcheckIcon />,
    },
    {
      key: "remove-all",
      label: "Delete every line break",
      checked: removeAllLineBreaks,
      onChange: handleToggleRemoveAll,
      icon: <RemoveBreaksIcon />,
    },
    {
      key: "keep-double",
      label: "Keep paragraph breaks (double line breaks)",
      checked: leaveDoubleLineBreaks,
      onChange: handleToggleLeaveDouble,
      icon: <KeepParagraphsIcon />,
    },
  ];

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
        {preferenceToggles.map((preference) => (
          <label key={preference.key} className="formatter__preference">
            <input
              type="checkbox"
              checked={preference.checked}
              onChange={preference.onChange}
              disabled={preferencesMutation.isPending}
            />
            <span className="formatter__preference-icon" aria-hidden="true">
              {preference.icon}
            </span>
            <span className="formatter__preference-text">{preference.label}</span>
          </label>
        ))}
        <label className="formatter__preference formatter__preference--select">
          <span className="formatter__preference-icon" aria-hidden="true">
            <SeparatorIcon />
          </span>
          <span className="formatter__preference-text">
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
          </span>
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
              <div className="formatter__preview-leading">
                <span className="formatter__preview-icon" aria-hidden="true">
                  <BudgetIcon />
                </span>
                <code>{value}</code>
              </div>
              <span>{formatBudget(value, separator)}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
};

export default InputFormatter;
