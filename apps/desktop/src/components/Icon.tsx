import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "compass"
  | "passport"
  | "warehouse"
  | "locker"
  | "balance"
  | "share"
  | "chart"
  | "sliders"
  | "book"
  | "wand"
  | "feather"
  | "terminal"
  | "module";

type IconDefinition = {
  viewBox: string;
  strokeWidth?: number;
  paths: ReactNode;
};

const stroke = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const iconRegistry: Record<IconName | "default", IconDefinition> = {
  compass: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth={1.5} />
        <path
          d="m9.85 14.2 1.4-3.3a1.1 1.1 0 0 1 .6-.6l3.3-1.4-1.4 3.3a1.1 1.1 0 0 1-.6.6z"
          fill="currentColor"
          fillOpacity="0.85"
        />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" />
      </>
    ),
  },
  passport: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path
          {...stroke}
          d="M7.25 8.25h-1.5a1 1 0 0 0-1 1v8.75a1 1 0 0 0 1 1h1.5"
          strokeWidth={1.5}
        />
        <rect x="7.25" y="4.75" width="9.5" height="14.5" rx="1.75" stroke="currentColor" strokeWidth={1.5} />
        <path {...stroke} d="M9.5 9.5h5.5" strokeWidth={1.5} />
        <path {...stroke} d="M9.5 12h5.5" strokeWidth={1.5} />
        <path {...stroke} d="M9.5 14.5h3.5" strokeWidth={1.5} />
      </>
    ),
  },
  warehouse: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path
          {...stroke}
          d="M4.75 10.5 12 5.25l7.25 5.25v8.75a1 1 0 0 1-1 1H5.75a1 1 0 0 1-1-1z"
          strokeWidth={1.5}
        />
        <path {...stroke} d="M7 12.25h10" strokeWidth={1.5} />
        <path {...stroke} d="M9 20.25V15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5.25" strokeWidth={1.5} />
      </>
    ),
  },
  locker: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <rect x="6" y="5.25" width="12" height="13.5" rx="1.25" stroke="currentColor" strokeWidth={1.5} />
        <path {...stroke} d="M12 5.25v13.5" strokeWidth={1.5} />
        <path {...stroke} d="M6 11h12" strokeWidth={1.5} />
        <circle cx="15.5" cy="13.75" r="0.9" fill="currentColor" />
      </>
    ),
  },
  balance: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path {...stroke} d="M12 4.75v14.5" strokeWidth={1.5} />
        <path {...stroke} d="M6 9.25h12" strokeWidth={1.5} />
        <path {...stroke} d="m8.5 9.25-2.75 5.5h5.5z" strokeWidth={1.5} />
        <path {...stroke} d="m15.5 9.25-2.75 5.5h5.5z" strokeWidth={1.5} />
        <path {...stroke} d="M6 19.25h12" strokeWidth={1.5} />
      </>
    ),
  },
  share: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path {...stroke} d="M12 3.75v10.5" strokeWidth={1.5} />
        <path {...stroke} d="m8.25 7.5 3.75-3.75L15.75 7.5" strokeWidth={1.5} />
        <path
          {...stroke}
          d="M6.75 13.5h10.5a1.5 1.5 0 0 1 1.5 1.5v2.25a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5V15a1.5 1.5 0 0 1 1.5-1.5z"
          strokeWidth={1.5}
        />
      </>
    ),
  },
  chart: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path {...stroke} d="M4.75 19.25h14.5" strokeWidth={1.5} />
        <path {...stroke} d="M7 19.25v-5.5" strokeWidth={1.5} />
        <path {...stroke} d="M12 19.25v-9.5" strokeWidth={1.5} />
        <path {...stroke} d="M17 19.25v-3.5" strokeWidth={1.5} />
      </>
    ),
  },
  sliders: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path {...stroke} d="M4.75 9.5h5.5" strokeWidth={1.5} />
        <path {...stroke} d="M13.75 9.5h5.5" strokeWidth={1.5} />
        <circle cx="11.25" cy="9.5" r="1.75" stroke="currentColor" strokeWidth={1.5} />
        <path {...stroke} d="M4.75 15.5h3.5" strokeWidth={1.5} />
        <path {...stroke} d="M12.75 15.5h6.5" strokeWidth={1.5} />
        <circle cx="10.25" cy="15.5" r="1.75" stroke="currentColor" strokeWidth={1.5} />
      </>
    ),
  },
  book: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path
          {...stroke}
          d="M11.5 5.25H7.25A2.5 2.5 0 0 0 4.75 7.75v9.5a2 2 0 0 1 1.75-.75h5"
          strokeWidth={1.5}
        />
        <path
          {...stroke}
          d="M12.5 5.25h4.25A2.5 2.5 0 0 1 19.25 7.75v9.5a2 2 0 0 0-1.75-.75h-5"
          strokeWidth={1.5}
        />
        <path {...stroke} d="M12 5.25v11.25" strokeWidth={1.5} />
        <path {...stroke} d="M14.5 9.5h2" strokeWidth={1.5} />
        <path {...stroke} d="M14.5 12h2" strokeWidth={1.5} />
      </>
    ),
  },
  wand: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path {...stroke} d="m7.5 16.5 6.5-6.5" strokeWidth={1.5} />
        <path
          d="m16 5.25.45 1.7 1.7.45-1.7.45-.45 1.7-.45-1.7-1.7-.45 1.7-.45z"
          fill="currentColor"
        />
        <path {...stroke} d="M5.75 13.75 7 15" strokeWidth={1.5} />
        <path {...stroke} d="M16.75 16.75 18 18" strokeWidth={1.5} />
      </>
    ),
  },
  feather: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path
          {...stroke}
          d="M16 4.75c-3.25 0-7.25 4-7.25 7.25 0 2.15 1.6 3.75 3.75 3.75 3.25 0 7.25-4.25 7.25-7.25A3.75 3.75 0 0 0 16 4.75z"
          strokeWidth={1.5}
        />
        <path {...stroke} d="M8.75 18.25 18 9" strokeWidth={1.5} />
        <path {...stroke} d="M10.5 19.25 8.75 17.5" strokeWidth={1.5} />
      </>
    ),
  },
  terminal: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <rect x="4.75" y="5.75" width="14.5" height="12.5" rx="1.5" stroke="currentColor" strokeWidth={1.5} />
        <path {...stroke} d="m8.25 9.5 3 2.5-3 2.5" strokeWidth={1.5} />
        <path {...stroke} d="M11.75 15.5h3.75" strokeWidth={1.5} />
      </>
    ),
  },
  module: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <path {...stroke} d="M12 4.5 6 8v8l6 3.5 6-3.5V8z" strokeWidth={1.5} />
        <path {...stroke} d="M6 8 12 11.5 18 8" strokeWidth={1.5} />
        <path {...stroke} d="M12 11.5V19" strokeWidth={1.5} />
      </>
    ),
  },
  default: {
    viewBox: "0 0 24 24",
    paths: (
      <>
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth={1.5} />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} />
      </>
    ),
  },
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  name: IconName;
  title?: string;
}

export const Icon = ({ name, title, className, strokeWidth, ...rest }: IconProps) => {
  const definition = iconRegistry[name] ?? iconRegistry.default;
  const resolvedStrokeWidth = strokeWidth ?? definition.strokeWidth ?? 1.5;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={definition.viewBox}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={className}
      stroke="currentColor"
      fill="none"
      strokeWidth={resolvedStrokeWidth}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {definition.paths}
    </svg>
  );
};

export default Icon;
