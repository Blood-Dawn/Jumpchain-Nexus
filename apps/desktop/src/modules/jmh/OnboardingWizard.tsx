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
import { useMutation } from "@tanstack/react-query";
import { runOnboarding, type OnboardingPayload } from "./onboarding";
import { loadSnapshot } from "./data";
import { useJmhStore } from "./store";

export interface OnboardingWizardProps {
  onFinished: () => void;
}

const BLANK_PAYLOAD: OnboardingPayload = {
  universeName: "",
  jumpTitle: "",
  origin: "",
  perks: ["", "", ""],
  premiseLines: ["", "", ""],
};

type PerkIndex = 0 | 1 | 2;
type PremiseIndex = 0 | 1 | 2;

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onFinished }) => {
  const [payload, setPayload] = useState<OnboardingPayload>(BLANK_PAYLOAD);
  const setOnboardingComplete = useJmhStore((state) => state.setOnboardingComplete);
  const setJumps = useJmhStore((state) => state.setJumps);
  const setEntities = useJmhStore((state) => state.setEntities);
  const setNotes = useJmhStore((state) => state.setNotes);
  const setRecaps = useJmhStore((state) => state.setRecaps);
  const setNextActions = useJmhStore((state) => state.setNextActions);

  const mutation = useMutation({
    mutationFn: async () => {
      await runOnboarding(payload);
      const snapshot = await loadSnapshot();
      setJumps(snapshot.jumps);
      setEntities(snapshot.entities);
      setNotes(snapshot.notes);
      setRecaps(snapshot.recaps);
      setNextActions(snapshot.nextActions);
    },
    onSuccess: () => {
      setOnboardingComplete(true);
      onFinished();
    },
  });

  const updatePerk = (index: PerkIndex, value: string) => {
    setPayload((current) => {
      const next = [...current.perks] as typeof current.perks;
      next[index] = value;
      return { ...current, perks: next };
    });
  };

  const updatePremise = (index: PremiseIndex, value: string) => {
    setPayload((current) => {
      const next = [...current.premiseLines] as typeof current.premiseLines;
      next[index] = value;
      return { ...current, premiseLines: next };
    });
  };

  const canSubmit =
    payload.universeName.trim() && payload.jumpTitle.trim() && payload.origin.trim();

  return (
    <div className="onboarding-overlay">
      <section className="onboarding">
        <header>
          <h1>Jumpchain Nexus: First Jump Setup</h1>
          <p>We need a few details to tune your Story Studio and timeline.</p>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            mutation.mutate();
          }}
        >
          <div className="onboarding__grid">
            <label>
              Universe or Setting
              <input
                type="text"
                value={payload.universeName}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, universeName: event.target.value }))
                }
                placeholder="e.g. Worm"
              />
            </label>
            <label>
              First Jump Title
              <input
                type="text"
                value={payload.jumpTitle}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, jumpTitle: event.target.value }))
                }
                placeholder="e.g. Protectorate Orientation"
              />
            </label>
            <label>
              Origin
              <input
                type="text"
                value={payload.origin}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, origin: event.target.value }))
                }
                placeholder="Think about your starting foothold"
              />
            </label>
          </div>

          <fieldset className="onboarding__perks">
            <legend>Three Perks worth spotlighting</legend>
            {payload.perks.map((perk, index) => (
              <input
                key={index}
                type="text"
                value={perk}
                placeholder={`Perk ${index + 1}`}
                onChange={(event) => updatePerk(index as PerkIndex, event.target.value)}
              />
            ))}
          </fieldset>

          <fieldset className="onboarding__premise">
            <legend>Three-line premise</legend>
            {payload.premiseLines.map((line, index) => (
              <textarea
                key={index}
                value={line}
                placeholder={`Line ${index + 1}`}
                rows={2}
                onChange={(event) => updatePremise(index as PremiseIndex, event.target.value)}
              />
            ))}
          </fieldset>

          <footer className="onboarding__actions">
            <button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? "Fitting jump threads…" : "Create Jump"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default OnboardingWizard;
