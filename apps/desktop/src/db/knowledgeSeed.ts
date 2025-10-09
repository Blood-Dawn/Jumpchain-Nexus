/*
MIT License

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

export interface KnowledgeSeedEntry {
  title: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  source?: string;
}

// Derived from the legacy Jumpchain Knowledge Base topics and modernized for the Nexus layout.
export const knowledgeSeed: KnowledgeSeedEntry[] = [
  {
    title: "Jump Lifecycle Overview",
    category: "Core Systems",
    summary: "How the legacy app organized jumps, builds, and companions across the chain.",
    content:
      "Jumpchain Nexus mirrors the original Builder's lifecycle: create a jump, configure its origins, record purchases, and track drawbacks. Each jump persists its own asset ledger so exports and statistics always match the in-app state. Use the Jump Hub timeline to stage, in-progress, or retired jumps, then drill into supplements for per-jump context.",
    tags: ["overview", "jumps", "workflow"],
    source: "Legacy Manual",
  },
  {
    title: "Budget Automation & Point Banks",
    category: "Budgets",
    summary: "Explains automated stipend math, discounts, freebies, and bank policies.",
    content:
      "Budgets combine jump-level currencies with per-character point banks. Discounts halve the stored cost, freebies remove net cost but retain the raw price for analytics. Global options control whether banks stack across gauntlets, companions, or supplemented jumps; when enabled, Balance = Drawback Credit - Net Cost. Configure defaults in Jump Options before creating new jumps.",
    tags: ["budget", "discounts", "banks"],
    source: "Legacy Manual",
  },
  {
    title: "Origin & Misc Category Management",
    category: "Origins",
    summary: "Maintaining origin trees, misc slots, and stipend mapping.",
    content:
      "Origins drive discount thresholds and stipend routing. In the legacy app, Origin Details, Misc Origins, and Purchase Types shared category lists. The Nexus overview editor keeps the same relationships: add origins, choose type (Species, Location, Background) and align Misc entries so stipend automation can look up their costs. Remember to refresh stipend thresholds whenever you import a legacy XML save.",
    tags: ["origins", "stipends", "categories"],
    source: "Legacy Manual",
  },
  {
    title: "Supplement Configuration",
    category: "Supplements",
    summary: "Mapping Warehouse, Locker, and Drawback modules to global settings.",
    content:
      "Cosmic Warehouse and Locker toggles depend on the supplement preset selected in Jump Options. Personal Reality unlocks limitation tracking and storage analytics, while Universal Drawback supplements expose UU toggles in the drawback module. Essential Body Mod options are linked to the Locker's dependency warnings so you can see when a booster conflicts with a universal perk.",
    tags: ["supplements", "warehouse", "locker"],
    source: "Legacy Manual",
  },
  {
    title: "Export Pipelines",
    category: "Exports",
    summary: "How Nexus generates Generic, BBCode, and Markdown packages.",
    content:
      "Exports retain the section toggles from the WPF builder. Each format applies its own formatter stack: Generic (plain text), BBCode (forum-ready), Markdown (docs). The Export Options module stores presets in SQLite so you can reuse layouts across chains. Spoiler wrapping and reverse budget modes are handled per-format—enable them in options before triggering an export run.",
    tags: ["exports", "bbcode", "markdown"],
    source: "Legacy Manual",
  },
  {
    title: "Randomizer Weights & Filters",
    category: "Tools",
    summary: "Legacy weighting rules for jump, perk, and drawback randomization.",
    content:
      "Randomizers pull from curated pools that respect your filter toggles. The classic builder weighted unfinished jumps heavier, excluded gauntlets when requested, and preferred draws that matched active companions. Nexus keeps those heuristics and adds deterministic seeding so you can reproduce a roll. Use the Tools > Randomizer section to set filters and history depth.",
    tags: ["randomizer", "weights", "filters"],
    source: "Legacy Manual",
  },
  {
    title: "Input Formatter Best Practices",
    category: "Tools",
    summary: "Cleaning PDF or wiki text before storing it on entities.",
    content:
      "FormatHelper in the legacy app stripped smart quotes, extra line breaks, and power rankings. Nexus reimplements the pipeline with streaming text normalization. When pasting perk descriptions, run them through the formatter to normalize bullets and budgets—this keeps exports consistent and improves full-text search results across notes, files, and knowledge articles.",
    tags: ["formatter", "text", "cleanup"],
    source: "Legacy Manual",
  },
  {
    title: "Story Studio References",
    category: "Story",
    summary: "Linking narrative chapters to chain entities.",
    content:
      "Story Studio's chapter mentions replaced the WPF clipboard helpers. Mentions sync with the entity table so you can pivot from prose to mechanics. Use the mention panel to tag perks, locations, or characters directly in the editor; Nexus surfaces those cross-links in the knowledge base and future statistics panes.",
    tags: ["story", "mentions", "studio"],
    source: "Story Studio",
  },
];
