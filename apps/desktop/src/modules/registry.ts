import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

export type ModuleSection = "build" | "supplements" | "tools" | "story";

export interface ModuleDef {
  id: string;
  title: string;
  description: string;
  path: string;
  section: ModuleSection;
  element: LazyExoticComponent<ComponentType>;
  icon?: string;
  badge?: string;
  requires?: string[];
}

const lazyModule = (loader: () => Promise<{ default: ComponentType }>) => lazy(loader);

export const modules: ModuleDef[] = [
  {
    id: "jump-hub",
    title: "Jump Overview",
    description: "Manage jumps & builds",
    path: "overview",
    section: "build",
    element: lazyModule(() => import("./overview")),
  },
  {
    id: "jump-memory-hub",
    title: "Jump Memory Hub",
    description: "Timeline & archives",
    path: "hub",
    section: "build",
    element: lazyModule(() => import("./jmh")),
  },
  {
    id: "cosmic-passport",
    title: "Cosmic Passport",
    description: "Profile & attributes",
    path: "passport",
    section: "supplements",
    element: lazyModule(() => import("./passport")),
  },
  {
    id: "cosmic-warehouse",
    title: "Cosmic Warehouse",
    description: "Configure storage",
    path: "warehouse",
    section: "supplements",
    element: lazyModule(() => import("./warehouse")),
  },
  {
    id: "cosmic-locker",
    title: "Cosmic Locker",
    description: "Catalog items",
    path: "locker",
    section: "supplements",
    element: lazyModule(() => import("./locker")),
  },
  {
    id: "drawback-supplement",
    title: "Drawback Supplement",
    description: "Rules & mechanics",
    path: "drawbacks",
    section: "supplements",
    element: lazyModule(() => import("./drawbacks")),
  },
  {
    id: "exporter",
    title: "Exports",
    description: "Share builds & notes",
    path: "export",
    section: "tools",
    element: lazyModule(() => import("./export")),
  },
  {
    id: "statistics",
    title: "Statistics",
    description: "Totals & analytics",
    path: "stats",
    section: "tools",
    element: lazyModule(() => import("./stats")),
  },
  {
    id: "jump-options",
    title: "Jump Options",
    description: "Defaults & categories",
    path: "options",
    section: "tools",
    element: lazyModule(() => import("./options")),
  },
  {
    id: "input-formatter",
    title: "Input Formatter",
    description: "Clean pasted text",
    path: "formatter",
    section: "tools",
    element: lazyModule(() => import("./formatter")),
  },
  {
    id: "jump-randomizer",
    title: "Jump Randomizer",
    description: "Weighted selection",
    path: "randomizer",
    section: "tools",
    element: lazyModule(() => import("./randomizer")),
  },
  {
    id: "story-studio",
    title: "Story Studio",
    description: "Write chapters & recaps",
    path: "studio",
    section: "story",
    element: lazyModule(() => import("./studio")),
  },
];

export const defaultModuleId = "jump-hub";

export const sectionOrder: ModuleSection[] = ["build", "supplements", "tools", "story"];

export const sectionLabels: Record<ModuleSection, string> = {
  build: "Build",
  supplements: "Supplements",
  tools: "Tools",
  story: "Story",
};

export const defaultModule = modules.find((module) => module.id === defaultModuleId) ?? modules[0];

export const resolveModulePath = (module: ModuleDef): string => `/${module.path}`;
