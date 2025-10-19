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

import React, { Suspense, lazy, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadSnapshot } from "./data";
import { useJmhShallow } from "./store";
import { GlobalSearch } from "./GlobalSearch";
import { Timeline } from "./Timeline";
import { NextActionsPanel } from "./NextActionsPanel";
import { PageLayoutRightPane } from "../../components/PageLayout";
import { AssetWorkbench } from "./AssetWorkbench";
const NarrativeSummaryPanel = lazy(async () => import("./NarrativeSummaryPanel"));
const HelpPane = lazy(async () => import("./HelpPane"));
const OnboardingWizard = lazy(async () => import("./OnboardingWizard"));

export const JumpMemoryHub: React.FC = () => {
  const [
    setJumps,
    setEntities,
    setNotes,
    setRecaps,
    setNextActions,
    setOnboardingComplete,
    onboardingComplete,
    helpPaneOpen,
    setHelpPaneOpen,
    onboardingOpen,
    setOnboardingOpen,
    selectedJumpId,
    setSelectedJump,
  ] = useJmhShallow((state) =>
    [
      state.setJumps,
      state.setEntities,
      state.setNotes,
      state.setRecaps,
      state.setNextActions,
      state.setOnboardingComplete,
      state.onboardingComplete,
      state.helpPaneOpen,
      state.setHelpPaneOpen,
      state.onboardingOpen,
      state.setOnboardingOpen,
      state.selectedJumpId,
      state.setSelectedJump,
    ] as const,
  );

  const snapshotQuery = useQuery({
    queryKey: ["jmh-snapshot"],
    queryFn: loadSnapshot,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: "offlineFirst",
    structuralSharing: true,
    retry: 1,
  });

  useEffect(() => {
    const snapshot = snapshotQuery.data;
    if (!snapshot) {
      return;
    }
    const { jumps, entities, notes, recaps, nextActions } = snapshot;
    setJumps(jumps);
    setEntities(entities);
    setNotes(notes);
    setRecaps(recaps);
    setNextActions(nextActions);
    const hasExistingData = jumps.length > 0 || notes.length > 0 || recaps.length > 0;
    if (hasExistingData) {
      setOnboardingComplete(true);
    }
    if (!selectedJumpId && jumps.length > 0) {
      setSelectedJump(jumps[0].id);
    }
  }, [
    snapshotQuery.data,
    selectedJumpId,
    setEntities,
    setJumps,
    setNextActions,
    setNotes,
    setOnboardingComplete,
    setRecaps,
    setSelectedJump,
  ]);

  const showWizard = onboardingOpen;

  const rightPane = useMemo(() => {
    if (!helpPaneOpen) {
      return null;
    }
    return (
      <Suspense fallback={<div className="help-pane help-pane--loading">Loading help…</div>}>
        <HelpPane />
      </Suspense>
    );
  }, [helpPaneOpen]);

  return (
    <>
      <PageLayoutRightPane>{rightPane}</PageLayoutRightPane>
      <header className="hub-header">
        <div className="hub-header__art" aria-hidden="true">
          <svg viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice" role="presentation">
            <defs>
              <radialGradient id="hubHeaderGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(122, 203, 255, 0.75)" />
                <stop offset="65%" stopColor="rgba(122, 203, 255, 0.15)" />
                <stop offset="100%" stopColor="rgba(122, 203, 255, 0)" />
              </radialGradient>
              <linearGradient id="hubHeaderWave" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(91, 115, 255, 0.4)" />
                <stop offset="100%" stopColor="rgba(78, 205, 196, 0.15)" />
              </linearGradient>
            </defs>
            <g className="hub-header__art-orbs">
              <circle className="hub-header__art-glow" cx="560" cy="140" r="220" fill="url(#hubHeaderGlow)" />
              <circle cx="210" cy="60" r="70" fill="rgba(91, 115, 255, 0.22)" />
              <circle cx="120" cy="250" r="110" fill="rgba(78, 205, 196, 0.18)" />
            </g>
            <g className="hub-header__art-particles" stroke="url(#hubHeaderWave)" strokeWidth="1.5" fill="none">
              <path d="M-20 240 Q 140 180 300 220 T 640 210 T 860 250" opacity="0.45" />
              <path d="M0 120 Q 160 80 320 110 T 660 130 T 820 150" opacity="0.3" />
              <path d="M-40 60 Q 120 40 280 70 T 600 90 T 840 120" opacity="0.18" />
            </g>
            <g className="hub-header__art-particles" fill="rgba(255, 255, 255, 0.35)">
              <circle cx="150" cy="140" r="2.5" />
              <circle cx="280" cy="90" r="3" />
              <circle cx="380" cy="210" r="2" />
              <circle cx="520" cy="80" r="2.8" />
              <circle cx="660" cy="180" r="2.2" />
            </g>
          </svg>
        </div>
        <div className="hub-header__title">
          <h1>Jump Memory Hub</h1>
          <p>Centralize notes, recaps, and prep across your chain.</p>
        </div>
        <div className="hub-header__actions">
          <button
            type="button"
            className="hub-header__cta"
            onClick={() => setOnboardingOpen(true)}
            disabled={onboardingOpen}
          >
            {onboardingComplete ? "Plan New Jump" : "Start First Jump"}
          </button>
          <GlobalSearch />
          <button
            type="button"
            className="hub-header__help-toggle"
            onClick={() => setHelpPaneOpen(!helpPaneOpen)}
          >
            {helpPaneOpen ? "Hide Help" : "Show Help"}
          </button>
        </div>
      </header>
      <AssetWorkbench />
      <section className="hub-grid">
        <div className="hub-grid__timeline">
          <Timeline />
        </div>
        <div className="hub-grid__next">
          <NextActionsPanel />
        </div>
      </section>
      <section className="hub-notes">
        <Suspense fallback={<div className="hub-loading">Loading narrative highlights…</div>}>
          <NarrativeSummaryPanel />
        </Suspense>
      </section>
      {showWizard && (
        <Suspense fallback={null}>
          <OnboardingWizard
            onFinished={() => {
              snapshotQuery.refetch().catch((error) => console.error("Failed to refresh snapshot", error));
            }}
            onDismiss={() => setOnboardingOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};

export default JumpMemoryHub;
