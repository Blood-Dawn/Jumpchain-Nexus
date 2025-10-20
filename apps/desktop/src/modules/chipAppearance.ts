import type { CSSProperties } from "react";

export interface ChipVisual {
  icon: string;
  accent?: string;
  glow?: string;
}

interface ChipPattern extends ChipVisual {
  match: RegExp;
}

const defaultVisual: ChipVisual = {
  icon: "🏷️",
  accent: "#7acbff",
  glow: "rgba(122, 203, 255, 0.32)",
};

const chipPatterns: ChipPattern[] = [
  { match: /^all(\s|$)/, icon: "🌐", accent: "#8fd8ff", glow: "rgba(143, 216, 255, 0.34)" },
  { match: /(critical|urgent|alert|hazard)/, icon: "🚨", accent: "#ff8a8a", glow: "rgba(255, 138, 138, 0.38)" },
  { match: /(weapon|blade|sword|gun|rifle|combat|offen)/, icon: "🗡️", accent: "#ff9b9b", glow: "rgba(255, 155, 155, 0.34)" },
  { match: /(armor|defen|shield|guard)/, icon: "🛡️", accent: "#7cb8ff", glow: "rgba(124, 184, 255, 0.32)" },
  { match: /(medical|medic|heal|surgery|clinic|first aid|triage|pharma)/, icon: "🩺", accent: "#9ef5cf", glow: "rgba(158, 245, 207, 0.32)" },
  { match: /(logistic|supply|storage|stock|inventory|cargo|warehouse)/, icon: "📦", accent: "#ffd89a", glow: "rgba(255, 216, 154, 0.36)" },
  { match: /(tech|device|gadget|computer|cyber|robot|mechan|engineer)/, icon: "🤖", accent: "#9dbdff", glow: "rgba(157, 189, 255, 0.34)" },
  { match: /(magic|spell|arcane|mystic|sorcer|enchant|mana|ritual)/, icon: "✨", accent: "#d6b4ff", glow: "rgba(214, 180, 255, 0.36)" },
  { match: /(psionic|mental|mind|psych|telepath)/, icon: "🧠", accent: "#f4a9d8", glow: "rgba(244, 169, 216, 0.34)" },
  { match: /(companion|ally|follower|retinue|pet|support team)/, icon: "🧑‍🤝‍🧑", accent: "#f7b692", glow: "rgba(247, 182, 146, 0.32)" },
  { match: /(training|skill|education|study|learn|drill|practice|manual)/, icon: "📘", accent: "#9fc5ff", glow: "rgba(159, 197, 255, 0.32)" },
  { match: /(booster|augment|upgrade|buff)/, icon: "⚡", accent: "#ffe08a", glow: "rgba(255, 224, 138, 0.38)" },
  { match: /(consum|food|ration|potion|brew|elixir|chemical|dose|fuel)/, icon: "🥤", accent: "#ffb5d8", glow: "rgba(255, 181, 216, 0.34)" },
  { match: /(travel|vehicle|ship|craft|transport|flight|portal|teleport)/, icon: "🚀", accent: "#ffd1a6", glow: "rgba(255, 209, 166, 0.34)" },
  { match: /(body mod|body-mod|body\s?mod|augmentation|augment|mutation|genetic|bio)/, icon: "🧬", accent: "#7de3ff", glow: "rgba(125, 227, 255, 0.36)" },
  { match: /(universal|shared|global)/, icon: "🪐", accent: "#8ed4ff", glow: "rgba(142, 212, 255, 0.34)" },
  { match: /(essential|core|vital)/, icon: "💠", accent: "#ffaf91", glow: "rgba(255, 175, 145, 0.34)" },
  { match: /(non-?booster|baseline)/, icon: "🚫", accent: "#ff9db1", glow: "rgba(255, 157, 177, 0.32)" },
  { match: /(packed|ready|prepared|stowed)/, icon: "✅", accent: "#9de8ae", glow: "rgba(157, 232, 174, 0.32)" },
  { match: /(unpacked|pending|todo|outstanding)/, icon: "📋", accent: "#ffcf91", glow: "rgba(255, 207, 145, 0.32)" },
  { match: /(high)/, icon: "⬆️", accent: "#ffd37f", glow: "rgba(255, 211, 127, 0.32)" },
  { match: /(medium|mid)/, icon: "↗️", accent: "#9bd6ff", glow: "rgba(155, 214, 255, 0.32)" },
  { match: /(low|minor)/, icon: "⬇️", accent: "#9ad5b0", glow: "rgba(154, 213, 176, 0.32)" },
  { match: /(general|misc|utility|support)/, icon: "🧰", accent: "#c3d2f5", glow: "rgba(195, 210, 245, 0.28)" },
  { match: /(note|info|guide|reference)/, icon: "📝", accent: "#aebcff", glow: "rgba(174, 188, 255, 0.3)" },
  { match: /(favorite|favourite|star|spotlight)/, icon: "⭐", accent: "#ffe38a", glow: "rgba(255, 227, 138, 0.36)" },
];

export const getChipVisual = (label: string): ChipVisual => {
  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return defaultVisual;
  }
  const pattern = chipPatterns.find((entry) => entry.match.test(normalized));
  if (!pattern) {
    return defaultVisual;
  }
  return {
    icon: pattern.icon,
    accent: pattern.accent ?? defaultVisual.accent,
    glow: pattern.glow ?? defaultVisual.glow,
  };
};

export const getChipStyle = (visual: ChipVisual): CSSProperties | undefined => {
  const variables: Record<string, string> = {};
  if (visual.accent) {
    variables["--chip-accent"] = visual.accent;
  }
  if (visual.glow) {
    variables["--chip-glow"] = visual.glow;
  }
  return Object.keys(variables).length > 0 ? (variables as CSSProperties) : undefined;
};

const needsTitleCase = (label: string): boolean => {
  return !/[A-Z]/.test(label);
};

const toTitleCase = (label: string): string => {
  return label.replace(/(^|[\s\-_/])([a-z])/g, (_, prefix: string, char: string) => `${prefix}${char.toUpperCase()}`);
};

export const formatChipLabel = (label: string): string => {
  const trimmed = label.trim();
  if (!trimmed) {
    return "";
  }
  if (!needsTitleCase(trimmed)) {
    return trimmed;
  }
  return toTitleCase(trimmed);
};

