import type { JSONContent } from "@tiptap/core";

export interface StudioTemplate {
  id: string;
  title: string;
  description: string;
  content: JSONContent | JSONContent[];
}

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: text
    ? [
        {
          type: "text",
          text,
        },
      ]
    : [],
});

const heading = (level: number, text: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [
    {
      type: "text",
      text,
    },
  ],
});

const bulletList = (items: string[]): JSONContent => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(item)],
  })),
});

export const studioTemplates: StudioTemplate[] = [
  {
    id: "heros-journey",
    title: "Hero's Journey",
    description: "Structure an adventure arc with beats for setup, trials, and return.",
    content: [
      heading(2, "Opening Hook"),
      paragraph("Introduce the stakes, location, and the spark that drags the jumper into action."),
      heading(3, "Allies & Assets"),
      bulletList([
        "Key companions joining the mission",
        "Artifacts or perks to highlight",
        "Intel gathered before the leap",
      ]),
      heading(2, "Trials"),
      paragraph("Detail escalating challenges, setbacks, and how the jumper adapts."),
      heading(2, "Return & Rewards"),
      paragraph("Close the loop with lessons learned, repercussions, and seeds for the next jump."),
    ],
  },
  {
    id: "mission-report",
    title: "Mission Report",
    description: "Summarize objectives, outcomes, and follow-up tasks after a jump.",
    content: [
      heading(2, "Mission Overview"),
      bulletList([
        "Objective:",
        "Deployment Zone:",
        "Primary Opposition:",
      ]),
      heading(2, "Timeline"),
      paragraph("Capture major beats chronologically with timestamps if relevant."),
      heading(2, "Results"),
      bulletList([
        "Successes:",
        "Complications:",
        "Casualties or Losses:",
      ]),
      heading(2, "Follow-up Actions"),
      paragraph("List outstanding debts, reputation shifts, and prep for the next deployment."),
    ],
  },
  {
    id: "companion-profile",
    title: "Companion Profile",
    description: "Build out a companion's story, motivations, and combat role.",
    content: [
      heading(2, "Identity"),
      bulletList([
        "Name:",
        "Origin Jump:",
        "Notable Traits:",
      ]),
      heading(2, "Motivations"),
      paragraph("Describe what keeps this companion loyal and how they evolve across jumps."),
      heading(2, "Loadout"),
      bulletList([
        "Primary abilities or perks",
        "Gear and artifacts",
        "Synergies with the jumper",
      ]),
      heading(2, "Story Hooks"),
      paragraph("Note future plot threads, rivalries, or personal quests to explore."),
    ],
  },
];

export const findStudioTemplate = (templateId: string): StudioTemplate | undefined =>
  studioTemplates.find((template) => template.id === templateId);
