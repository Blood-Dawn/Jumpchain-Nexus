<!--
Bloodawn

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

# Perks

Perks represent persistent upgrades purchased with jump currency. They can be skills, traits, social modifiers, hardware, or metaphysical advantages.

## Why this matters

- **Point Accounting** – Each perk carries a cost, discount flags, and possible temporary status. Accurate capture preserves budget integrity and flows into exports.
- **Search & Mentions** – Tagging perks as entities drives @perk mentions inside the Story Studio so you can link references back to source purchases.
- **Synergy Tracking** – Enabling metadata storage for perk attributes (schools, tags, origin indexes) helps you surface combo opportunities in the Atlas.

### Capture Checklist

- **Cost & Currency** – Track both numeric cost and which currency bucket the perk pulls from.
- **Source Details** – Include the jump and character who purchased the perk. Imported perks should reference the supplying companion.
- **Attributes** – If the perk grants boosters, stat bumps, or conditional modifiers, attach structured metadata so aggregates and exports stay precise.
