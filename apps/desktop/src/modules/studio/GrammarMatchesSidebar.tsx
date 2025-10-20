/*
Bloodawn

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

import type { GrammarSuggestionWithRange } from "./Editor";

interface GrammarMatchesSidebarProps {
  enabled: boolean;
  loading: boolean;
  matches: GrammarSuggestionWithRange[];
  onAccept: (suggestion: GrammarSuggestionWithRange, replacement?: string) => void;
  onDismiss: (suggestion: GrammarSuggestionWithRange) => void;
  onToggle: () => void;
}

const GrammarMatchesSidebar: React.FC<GrammarMatchesSidebarProps> = ({
  enabled,
  loading,
  matches,
  onAccept,
  onDismiss,
  onToggle,
}) => {
  const hasMatches = matches.length > 0;

  return (
    <aside className="studio-grammar__sidebar" aria-live="polite">
      <div className="studio-grammar__sidebar-header">
        <h3>Grammar</h3>
        <button
          type="button"
          className="studio-grammar__toggle"
          aria-pressed={enabled}
          onClick={onToggle}
        >
          {enabled ? "Disable" : "Enable"}
        </button>
      </div>

      {loading && <p className="studio-grammar__sidebar-status">Checking grammar…</p>}

      {!enabled && !loading && (
        <p className="studio-grammar__sidebar-status">Grammar suggestions are disabled.</p>
      )}

      {enabled && !loading && !hasMatches && (
        <p className="studio-grammar__sidebar-status">No suggestions right now.</p>
      )}

      {enabled && hasMatches && (
        <ul className="studio-grammar__list">
          {matches.map((suggestion) => (
            <li key={suggestion.id} className="studio-grammar__list-item">
              <p className="studio-grammar__list-message">{suggestion.message}</p>
              <p className="studio-grammar__list-rule">{suggestion.rule.description}</p>
              <div className="studio-grammar__actions">
                {suggestion.replacements.slice(0, 3).map((replacement) => (
                  <button
                    type="button"
                    className="studio-grammar__action"
                    key={replacement.value}
                    onClick={() => onAccept(suggestion, replacement.value)}
                    aria-label={`Accept suggestion: ${replacement.value}`}
                  >
                    {replacement.value}
                  </button>
                ))}
                {suggestion.replacements.length === 0 && (
                  <button
                    type="button"
                    className="studio-grammar__action"
                    onClick={() => onAccept(suggestion)}
                  >
                    Accept
                  </button>
                )}
                <button
                  type="button"
                  className="studio-grammar__action studio-grammar__action--subtle"
                  onClick={() => onDismiss(suggestion)}
                >
                  Ignore
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};

export default GrammarMatchesSidebar;
