import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import chromedriver from "chromedriver";

const chromedriverExport = chromedriver as unknown as { path?: string; default?: string };
const chromedriverPath =
  chromedriverExport.path ??
  chromedriverExport.default ??
  (typeof chromedriver === "string" ? (chromedriver as unknown as string) : undefined) ??
  process.env.CHROMEDRIVER_PATH;

if (!chromedriverPath) {
  throw new Error(
    "Unable to locate the chromedriver binary. Ensure the `chromedriver` package is installed and exposes a path."
  );
}

export interface ChromedriverServiceOptions {
  port?: number;
  args?: string[];
}

export default class ChromedriverService {
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly options: ChromedriverServiceOptions;

  constructor(options: ChromedriverServiceOptions = {}) {
    this.options = options;
  }

  async onPrepare(): Promise<void> {
    const port = this.options.port ?? 9515;
    const args =
      this.options.args ??
      [`--port=${port}`, "--url-base=/wd/hub", "--allowed-origins=http://127.0.0.1:*"];

    this.process = spawn(chromedriverPath, args, {
      stdio: "ignore",
      windowsHide: true,
    });

    await this.waitForServer(port);
  }

  async onComplete(): Promise<void> {
    if (!this.process) {
      return;
    }

    await new Promise<void>((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      this.process.once("exit", () => resolve());
      this.process.kill();
    });

    this.process = null;
  }

  private async waitForServer(port: number, timeoutMs = 15000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const ready = await this.canConnect(port);
      if (ready) {
        return;
      }
      await delay(200);
    }

    throw new Error(`Timed out waiting for chromedriver to listen on port ${port}.`);
  }

  private canConnect(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ port, host: "127.0.0.1" }, () => {
        socket.end();
        resolve(true);
      });

      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
    });
  }
}
