<!--
MIT License

Copyright (c) 2025 Bloodawn

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
-->

# Scenarios

Scenarios are structured challenge tracks layered on top of the base jump. They define mission objectives, time limits, and custom rewards.

## Why this matters

- **Planning Cadence** – Scenario time boxes can reorder progression across your chain. Logging them keeps the timeline filter meaningful.
- **Reward Tracing** – Many scenarios hand out unique currencies or perks. Documenting them ensures they funnel into the right inventories.
- **Import Coordination** – Companion eligibility often hinges on scenario tier. Track scenario slots so the Import Manager can warn about conflicts.

### Recommended Fields

- Scenario tier or difficulty, if provided by the document.
- Entry cost (if any), separate from reward payout.
- Win/loss conditions, especially clauses that trigger early departure or escalation.
