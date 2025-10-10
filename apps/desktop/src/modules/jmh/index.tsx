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

import React, { Suspense, lazy, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadSnapshot } from "./data";
import { useJmhStore } from "./store";
import { GlobalSearch } from "./GlobalSearch";
import { Timeline } from "./Timeline";
import { NextActionsPanel } from "./NextActionsPanel";
import { PageLayoutRightPane } from "../../components/PageLayout";
import { AssetWorkbench } from "./AssetWorkbench";

const NotesEditor = lazy(async () => import("./NotesEditor"));
const HelpPane = lazy(async () => import("./HelpPane"));
const OnboardingWizard = lazy(async () => import("./OnboardingWizard"));

export const JumpMemoryHub: React.FC = () => {
  const setJumps = useJmhStore((state) => state.setJumps);
  const setEntities = useJmhStore((state) => state.setEntities);
  const setNotes = useJmhStore((state) => state.setNotes);
  const setRecaps = useJmhStore((state) => state.setRecaps);
  const setNextActions = useJmhStore((state) => state.setNextActions);
  const setOnboardingComplete = useJmhStore((state) => state.setOnboardingComplete);
  const onboardingComplete = useJmhStore((state) => state.onboardingComplete);
  const helpPaneOpen = useJmhStore((state) => state.helpPaneOpen);
  const setHelpPaneOpen = useJmhStore((state) => state.setHelpPaneOpen);
  const onboardingOpen = useJmhStore((state) => state.onboardingOpen);
  const setOnboardingOpen = useJmhStore((state) => state.setOnboardingOpen);
  const selectedJumpId = useJmhStore((state) => state.selectedJumpId);
  const setSelectedJump = useJmhStore((state) => state.setSelectedJump);

  const snapshotQuery = useQuery({
    queryKey: ["jmh-snapshot"],
    queryFn: loadSnapshot,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!snapshotQuery.data) {
      return;
    }
    const { jumps, entities, notes, recaps, nextActions } = snapshotQuery.data;
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

  const rightPane = helpPaneOpen ? (
    <Suspense fallback={<div className="help-pane help-pane--loading">Loading help…</div>}>
      <HelpPane />
    </Suspense>
  ) : null;

  return (
    <>
      <PageLayoutRightPane>{rightPane}</PageLayoutRightPane>
      <header className="hub-header">
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
        <Suspense fallback={<div className="hub-loading">Preparing Story Studio…</div>}>
          <NotesEditor />
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
