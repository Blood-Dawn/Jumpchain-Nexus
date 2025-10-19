import { lazy } from "react";
import type { ComponentProps, ComponentType, LazyExoticComponent } from "react";

import { RouteProfiler } from "../components/perf/RouteProfiler";

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
  requiredPermissions?: string[];
  accent?: string;
}

const lazyModule = <T extends ComponentType<any>>(id: string, loader: () => Promise<{ default: T }>) =>
  lazy(async () => {
    const mod = await loader();
    const Component = mod.default;
    const Wrapped = (props: ComponentProps<T>) => (
      <RouteProfiler id={id}>
        <Component {...props} />
      </RouteProfiler>
    );
    Wrapped.displayName = `${Component.displayName ?? Component.name ?? id}WithProfiler`;
    return { default: Wrapped } as { default: ComponentType };
  });

const sectionAccents: Record<ModuleSection, string> = {
  build: "210 100% 74%",
  supplements: "174 73% 64%",
  tools: "266 84% 76%",
  story: "350 100% 78%",
};

const moduleList: ModuleDef[] = [
  {
    id: "jump-hub",
    title: "Jump Hub",
    description: "Manage jumps & builds",
    path: "hub",
    section: "build",
    element: lazyModule("Jump Hub", () => import("./jmh")),
    requiredPermissions: ["jump-hub-sql"],
    accent: sectionAccents.build,
  },
  {
    id: "cosmic-passport",
    title: "Cosmic Passport",
    description: "Profile & attributes",
    path: "passport",
    section: "supplements",
    element: lazyModule("Cosmic Passport", () => import("./passport")),
    requiredPermissions: ["cosmic-passport-sql"],
    accent: sectionAccents.supplements,
  },
  {
    id: "cosmic-warehouse",
    title: "Cosmic Warehouse",
    description: "Configure storage",
    path: "warehouse",
    section: "supplements",
    element: lazyModule("Cosmic Warehouse", () => import("./warehouse")),
    requiredPermissions: ["cosmic-warehouse-sql"],
    accent: sectionAccents.supplements,
  },
  {
    id: "cosmic-locker",
    title: "Cosmic Locker",
    description: "Catalog items",
    path: "locker",
    section: "supplements",
    element: lazyModule("Cosmic Locker", () => import("./locker")),
    requiredPermissions: ["cosmic-locker-sql"],
    accent: sectionAccents.supplements,
  },
  {
    id: "drawback-supplement",
    title: "Drawback Supplement",
    description: "Rules & mechanics",
    path: "drawbacks",
    section: "supplements",
    element: lazyModule("Drawback Supplement", () => import("./drawbacks")),
    requiredPermissions: ["drawback-supplement-sql"],
    accent: sectionAccents.supplements,
  },
  {
    id: "exporter",
    title: "Exports",
    description: "Share builds & notes",
    path: "export",
    section: "tools",
    element: lazyModule("Exports", () => import("./export")),
    requiredPermissions: ["export-tools"],
    accent: sectionAccents.tools,
  },
  {
    id: "statistics",
    title: "Statistics",
    description: "Totals & analytics",
    path: "stats",
    section: "tools",
    element: lazyModule("Statistics", () => import("./stats")),
    requiredPermissions: ["statistics-sql"],
    accent: sectionAccents.tools,
  },
  {
    id: "jump-options",
    title: "Jump Options",
    description: "Defaults & categories",
    path: "options",
    section: "tools",
    element: lazyModule("Jump Options", () => import("./options")),
    requiredPermissions: ["jump-options-sql"],
    accent: sectionAccents.tools,
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    description: "Guides & best practices",
    path: "knowledge",
    section: "tools",
    element: lazyModule("Knowledge Base", () => import("./knowledge-base")),
    requiredPermissions: ["knowledge-base-sql"],
    accent: sectionAccents.tools,
  },
  {
    id: "input-formatter",
    title: "Input Formatter",
    description: "Clean pasted text",
    path: "formatter",
    section: "tools",
    element: lazyModule("Input Formatter", () => import("./formatter")),
    requiredPermissions: ["input-formatter-tools"],
    accent: sectionAccents.tools,
  },
  {
    id: "story-studio",
    title: "Story Studio",
    description: "Write chapters & recaps",
    path: "studio",
    section: "story",
    element: lazyModule("Story Studio", () => import("./studio")),
    requiredPermissions: ["story-studio-sql"],
    accent: sectionAccents.story,
  },
];

const devToolsEnabled = import.meta.env.VITE_DEVTOOLS_ENABLED === "true";

if (devToolsEnabled) {
  moduleList.push({
    id: "devtools-test-runner",
    title: "Developer Tools",
    description: "Run npm test suite",
    path: "devtools",
    section: "tools",
    element: lazyModule("Developer Tools", () => import("./devtools")),
    requiredPermissions: ["devtools-shell"],
    accent: sectionAccents.tools,
  });
}

export const modules: ModuleDef[] = moduleList;

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
