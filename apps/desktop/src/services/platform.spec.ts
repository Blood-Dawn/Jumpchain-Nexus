import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWebPlatform,
  getPlatform,
  initializePlatform,
  setPlatform,
  type ConfirmDialogOptions,
} from "./platform";

const pathMocks = vi.hoisted(() => ({
  appConfigDir: vi.fn(async () => "/config"),
  join: vi.fn(async (base: string, segment: string) => `${base}/${segment}`),
}));

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => true),
  readFile: vi.fn(async () => new Uint8Array([9, 8])),
  readTextFile: vi.fn(async () => "payload"),
}));

const dialogMocks = vi.hoisted(() => ({
  confirm: vi.fn(async () => true),
  open: vi.fn(async () => "/file.txt"),
  save: vi.fn(async () => "/save.txt"),
}));

vi.mock("@tauri-apps/api/path", () => pathMocks);
vi.mock("@tauri-apps/plugin-fs", () => fsMocks);
vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);

describe("platform service", () => {
  beforeEach(() => {
    setPlatform(createWebPlatform());
  });

  afterEach(() => {
    setPlatform(createWebPlatform());
    vi.clearAllMocks();
  });

  describe("web platform", () => {
    it("reads seeded files", async () => {
      const platform = createWebPlatform({
        files: {
          "/foo/text.txt": "hello world",
          "/foo/data.bin": new Uint8Array([1, 2, 3]),
        },
      });

      expect(await platform.fs.exists("/foo/text.txt")).toBe(true);
      expect(await platform.fs.readTextFile("/foo/text.txt")).toBe("hello world");
      const binary = await platform.fs.readBinaryFile("/foo/data.bin");
      expect(Array.from(binary)).toEqual([1, 2, 3]);
    });

    it("uses confirm handler fallback", async () => {
      const handler = vi.fn<[ConfirmDialogOptions], Promise<boolean>>().mockResolvedValue(false);
      const platform = createWebPlatform({ confirmHandler: handler });
      const options: ConfirmDialogOptions = { message: "Delete?" };
      await expect(platform.dialog.confirm(options)).resolves.toBe(false);
      expect(handler).toHaveBeenCalledWith(options);
    });

    it("falls back to web dialog when handler absent", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const platform = createWebPlatform();
      await expect(platform.dialog.confirm({ message: "continue" })).resolves.toBe(true);
      expect(confirmSpy).toHaveBeenCalledWith("continue");
      confirmSpy.mockRestore();
    });
  });

  describe("tauri platform adapter", () => {
    it("wraps tauri apis", async () => {
      const { createTauriPlatform } = await import("../../src-tauri/platformAdapter");
      const platform = createTauriPlatform();

      await expect(platform.path.appConfigDir()).resolves.toBe("/config");
      await expect(platform.path.join("/a", "b", "c")).resolves.toBe("/a/b/c");

      await platform.fs.ensureDir("/config", { recursive: false });
      expect(fsMocks.mkdir).toHaveBeenCalledWith("/config", { recursive: false });
      await expect(platform.fs.exists("/config")).resolves.toBe(true);
      await expect(platform.fs.readBinaryFile("/config/file.bin")).resolves.toEqual(new Uint8Array([9, 8]));
      await expect(platform.fs.readTextFile("/config/file.txt")).resolves.toBe("payload");

      await expect(platform.dialog.confirm({ message: "ok" })).resolves.toBe(true);
      expect(dialogMocks.confirm).toHaveBeenCalledWith("ok", expect.objectContaining({}));
      await expect(platform.dialog.openFile({ title: "Open" })).resolves.toEqual(["/file.txt"]);
      await expect(platform.dialog.saveFile({ title: "Save" })).resolves.toBe("/save.txt");
    });
  });

  it("initializes lazily", async () => {
    setPlatform(createWebPlatform({ configDir: "/defaults" }));
    await expect(getPlatform()).resolves.toEqual(expect.anything());
    await expect(initializePlatform()).resolves.toEqual(expect.anything());
  });
});
