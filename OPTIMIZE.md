# Optimization Playbook

This document summarizes the standard profiling, planning, and patching workflow for the Jumpchain Nexus project and highlights the metrics, tooling, and validation steps every contributor must follow.

## Profiling → Planning → Patching Workflow

1. **Profiling**
   - Instrument and monitor each required route: `Jump Hub`, `Passport`, `Warehouse`, `Locker`, `Drawbacks`, `Export`, `Stats`, `Options`, and `Story Studio`.
   - Capture the core metrics on every pass:
     - **Render counts** to identify excessive component re-renders.
     - **Long tasks** (≥50 ms) in the main thread and webview, paying special attention to Tauri bridge calls.
     - **Database round-trips** and query timings against SQLite.
     - **Network waterfalls** for API-heavy flows so you can spot sequential fetches or duplicate requests.
     - **Memory footprints** for large data sets (DevTools Performance/Memory tabs) to ensure we do not leak references between navigations.
   - Store findings with timestamps, the commit SHA, and reproduction steps in a profiling report.

2. **Planning**
   - Convert profiling insights into a prioritized list of hypotheses that address the largest performance regressions first.
   - For each hypothesis, document the affected route(s), suspected component(s), data layer touchpoints, and expected improvements to render counts, long tasks, or DB activity.
   - Define measurement checkpoints for before/after comparisons and outline any feature flags or A/B toggles needed during validation.

3. **Patching**
   - Implement only the planned optimizations, keeping commits scoped so metrics can be re-measured individually.
   - After each change, re-profile the affected routes to confirm that render counts, long tasks, and DB round-trips improve (or at least do not regress).
   - Update the profiling report with the observed deltas, screenshots, or trace exports as evidence.
   - When optimizations require a rollout plan, document guardrails (feature flag names, kill-switch dashboards) and the monitoring strategy so follow-up regressions can be reverted quickly.

### Recurring Optimization Tasks

- **Automation**: extend our Playwright/Cypress flows with trace capture to keep route coverage reproducible.
- **Budget tracking**: maintain per-route budgets (render count ceilings, LCP targets, DB round-trips) and flag breaches in PR descriptions.
- **Regression watch**: create follow-up tickets for hotspots that exceed budgets even after a patch so the next optimization cycle has clear starting points.
- **Knowledge sharing**: attach links to profiling exports and add short Loom walkthroughs when a fix requires non-obvious instrumentation.

## Technology-Specific Optimization Guidelines

### React
- Prefer memoized selectors and props (e.g., `useMemo`, `useCallback`, `React.memo`) to prevent unnecessary renders.
- Split large components into smaller chunks to minimize render surfaces per route.
- Use `Suspense` and code-splitting for route-level bundles where possible.
- Avoid inline object/array literals inside render paths unless memoized.
- Track commit phases with the React Profiler to identify components with large "Actual duration" spikes, and instrument long-lived contexts with logging to verify they do not broadcast every minor change.
- Keep expensive derived values inside memoized selectors (for example, TanStack Query `select` callbacks or Zustand selectors) so React only recalculates them when inputs truly change.
- When deferring non-critical work, prefer `useTransition` or `useDeferredValue` to keep interactive updates responsive.

### Zustand
- Co-locate state slices and use selectors to subscribe to minimal state.
- Rely on `zustand`'s `subscribeWithSelector` middleware for targeted reactivity.
- Guard against cascading updates by keeping derived data in selectors instead of the store state itself.
- Use `useShallow` (or custom comparator functions) around selectors that return compound objects so components only re-render when shallow-equal values change.
- Reset ephemeral slices on navigation or logout to prevent stale cache build-up and lower memory pressure.
- Prefer action creators that batch related updates to keep subscription notifications minimal.

### TanStack Query
- Configure query keys precisely to avoid cross-pollinating caches between routes.
- Tune `staleTime`, `cacheTime`, and background refetching to balance freshness with load.
- Favor `select` transformations and `placeholderData` to minimize re-renders when raw payloads are large.
- Invalidate queries deliberately; avoid blanket `queryClient.invalidateQueries()` calls.
- Leverage structural sharing and tracked property optimizations by avoiding object rest-spread on query results and destructuring only the fields a component reads.
- Use `keepPreviousData` for pagination or tabbed interfaces so navigation does not trigger jarring loading states.
- For mutation-heavy flows, co-locate optimistic updates with precise invalidation targets to avoid full cache resets.

### SQLite
- Batch related statements inside transactions to reduce per-request round-trips.
- Leverage prepared statements and parameter binding for frequently executed queries.
- Keep indices aligned with high-volume lookups discovered during profiling and remove unused indices.
- When processing large result sets, stream or paginate to keep memory footprints predictable.
- Evaluate `PRAGMA journal_mode=WAL` plus `synchronous=NORMAL` for interactive workloads where durability trade-offs are acceptable; fall back to `synchronous=FULL` when crash safety outweighs latency.
- Run `ANALYZE` after schema or index changes so the query planner has up-to-date statistics.
- Monitor cache hit rates (`PRAGMA cache_spill`, `PRAGMA cache_size`) and adjust to avoid thrashing when multiple routes share the same connection.

### Tauri
- Minimize synchronous blocking calls on the Rust side and prefer async commands bridged into the webview.
- Cache expensive filesystem or computation results in-memory when safe.
- Ensure window events and plugin hooks are debounced or throttled to prevent long tasks in the UI thread.
- Keep the Rust<->JS messaging payloads compact to reduce serialization overhead.
- Use the Tauri Inspector and DevTools Protocol tracing to verify there are no unexpected IPC waterfalls when routing between views.
- Prefer streaming responses (`tauri::api::http::Client` with async readers) for large payloads instead of buffering entire files into memory.
- Audit plugin usage periodically; disable unused plugins and strip debug logging from production builds to shrink bundle size and startup time.

## Validation Commands

Every optimization-focused change must be validated with the following commands:

```bash
npm ci
npm run test:full
npm run tauri:dev
```

Note: the hosted sandbox environment may not support running `npm run tauri:dev` end-to-end because Tauri often requires native prerequisites or GUI access that are unavailable in headless CI. Document any such limitations in your PR and, when applicable, rely on local machine validation.

## Reporting Checklist

- Record profiling metrics before and after patches with links to traces or logs.
- Capture screenshots or screen recordings for UI-visible improvements when feasible.
- Summarize learnings and remaining bottlenecks in the PR description to keep the optimization history discoverable.

