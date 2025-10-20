import { lazy } from "react";
import type { ComponentProps, ComponentType, LazyExoticComponent } from "react";

import { RouteProfiler } from "../components/perf/RouteProfiler";
import type { IconName } from "../components/Icon";

export type ModuleSection = "build" | "supplements" | "tools" | "story";

export interface ModuleDef {
  id: string;
  title: string;
  description: string;
  path: string;
  section: ModuleSection;
  element: LazyExoticComponent<ComponentType>;
  /**
   * Icons reference the SVG asset key in `apps/desktop/src/assets/icons` without the `.svg` suffix.
   * New assets should follow the shared guidelines: 24x24 viewBox and a stroke width of 1.75px so
   * they align with the Jumpchain Lucide-inspired set.
   */
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
    icon: "jump-hub",
    requiredPermissions: ["jump-hub-sql"],
    badge: "Alpha",
  },
  {
    id: "cosmic-passport",
    title: "Cosmic Passport",
    description: "Profile & attributes",
    path: "passport",
    section: "supplements",
    element: lazyModule("Cosmic Passport", () => import("./passport")),
    icon: "cosmic-passport",
    requiredPermissions: ["cosmic-passport-sql"],
    badge: "Preview",
  },
  {
    id: "cosmic-warehouse",
    title: "Cosmic Warehouse",
    description: "Configure storage",
    path: "warehouse",
    section: "supplements",
    element: lazyModule("Cosmic Warehouse", () => import("./warehouse")),
    icon: "cosmic-warehouse",
    requiredPermissions: ["cosmic-warehouse-sql"],
    badge: "Alpha",
  },
  {
    id: "cosmic-locker",
    title: "Cosmic Locker",
    description: "Catalog items",
    path: "locker",
    section: "supplements",
    element: lazyModule("Cosmic Locker", () => import("./locker")),
    icon: "cosmic-locker",
    requiredPermissions: ["cosmic-locker-sql"],
    badge: "Alpha",
  },
  {
    id: "drawback-supplement",
    title: "Drawback Supplement",
    description: "Rules & mechanics",
    path: "drawbacks",
    section: "supplements",
    element: lazyModule("Drawback Supplement", () => import("./drawbacks")),
    icon: "drawback-supplement",
    requiredPermissions: ["drawback-supplement-sql"],
    badge: "Preview",
  },
  {
    id: "exporter",
    title: "Exports",
    description: "Share builds & notes",
    path: "export",
    section: "tools",
    element: lazyModule("Exports", () => import("./export")),
    icon: "exporter",
    requiredPermissions: ["export-tools"],
    badge: "Beta",
  },
  {
    id: "statistics",
    title: "Statistics",
    description: "Totals & analytics",
    path: "stats",
    section: "tools",
    element: lazyModule("Statistics", () => import("./stats")),
    icon: "statistics",
    requiredPermissions: ["statistics-sql"],
    badge: "Prototype",
  },
  {
    id: "jump-options",
    title: "Jump Options",
    description: "Defaults & categories",
    path: "options",
    section: "tools",
    element: lazyModule("Jump Options", () => import("./options")),
    icon: "jump-options",
    requiredPermissions: ["jump-options-sql"],
    badge: "Prototype",
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    description: "Guides & best practices",
    path: "knowledge",
    section: "tools",
    element: lazyModule("Knowledge Base", () => import("./knowledge-base")),
    icon: "knowledge-base",
    requiredPermissions: ["knowledge-base-sql"],
    badge: "Preview",
  },
  {
    id: "input-formatter",
    title: "Input Formatter",
    description: "Clean pasted text",
    path: "formatter",
    section: "tools",
    element: lazyModule("Input Formatter", () => import("./formatter")),
    icon: "input-formatter",
    requiredPermissions: ["input-formatter-tools"],
    badge: "Beta",
  },
  {
    id: "story-studio",
    title: "Story Studio",
    description: "Write chapters & recaps",
    path: "studio",
    section: "story",
    element: lazyModule("Story Studio", () => import("./studio")),
    icon: "story-studio",
    requiredPermissions: ["story-studio-sql"],
    badge: "Beta",
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
    icon: "devtools",
    requiredPermissions: ["devtools-shell"],
    badge: "Internal",
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
