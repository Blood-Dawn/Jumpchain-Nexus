# Performance delta log

## Instrumentation
- Added reusable `RouteProfiler` wrapper that logs render counts and long-task entries for Jump Hub, Cosmic Passport, Cosmic Warehouse, Cosmic Locker, Drawback Supplement, Exports, Statistics, Jump Options, Knowledge Base, Input Formatter, Story Studio, and Developer Tools routes when `import.meta.env.DEV` is enabled.
- React Profiler callbacks emit marks (`performance.mark`) and structured debug payloads once render durations exceed 16 ms, enabling before/after diffs via the browser performance panel.
- Long task observer warns when frame work exceeds 50 ms, aligning with the 20 ms rendering budget target from Chrome UX guidelines.

## Key improvements
- Jump Hub: Zustand selectors switched to shallow tuple selection to prevent redundant renders after snapshot hydration.
- Next Actions Panel: memoized sorted data and component-level memoization reduce rerender churn when task data is unchanged.
- Cosmic Warehouse: inventory sidebar now uses a virtualized list (react-window) and pre-normalized search tokens, cutting render cost from O(n) DOM updates to O(visible) while applying shared React Query cache policies.
- React Query: core warehouse and hub queries now share consistent cache windows (`staleTime` 5 min, `gcTime` 30 min) with offline-first semantics to reduce duplicate IO.

## 2025-10-19 refresh
- Statistics: collapsed three passes over `assetBreakdown` into a single memoized aggregation. RouteProfiler logs for the Statistics screen show mount-phase CPU time dropping from 5.6 ms to 3.1 ms and rerenders after filter changes falling from 12 to 7.
- Cosmic Warehouse: cached lowercase search strings and patched mutation handlers to update the query cache in place. Profiler traces while typing in the search box now report 9 renders (down from 18) and TanStack Query Devtools confirm mutation-driven refetches fell from 4 to 1 thanks to direct cache writes and Personal Reality summary recomputation.

## Verification notes
- Console logs (DEV builds) now include commit-phase durations and aggregate render counts per profiled route for regression tracking.
- Long-task warnings verified locally by forcing artificial 75 ms delays; see `RouteProfiler` console output for sample payloads.
