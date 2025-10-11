/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_DEVTOOLS_ENABLED?: string;
  }
}

export {};
