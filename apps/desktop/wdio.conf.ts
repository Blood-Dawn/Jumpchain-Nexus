/*
Bloodawn

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

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Options } from "@wdio/types";
import ChromedriverService from "./test/wdio/chromedriver-service";

const chromedriverPort = Number.parseInt(process.env.CHROMEDRIVER_PORT ?? "9515", 10);
const wdioArtifactsRoot = path.resolve("test-results", "wdio");

export const config: Options.Testrunner = {
  runner: "local",
  specs: ["./test/wdio/specs/**/*.ts"],
  maxInstances: 1,
  logLevel: "warn",
  bail: 0,
  baseUrl: "http://localhost:1420",
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 1,
  hostname: "127.0.0.1",
  port: chromedriverPort,
  path: "/wd/hub",
  framework: "mocha",
  outputDir: path.join(wdioArtifactsRoot, "logs"),
  reporters: [
    "spec",
    [
      "junit",
      {
        outputDir: path.join(wdioArtifactsRoot, "junit"),
        outputFileFormat: (options: { cid: string }) => `wdio-${options.cid}.xml`,
      },
    ],
  ],
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: "./tsconfig.json",
    },
  },
  services: [[ChromedriverService, { port: chromedriverPort }]],
  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: ["--headless=new", "--disable-gpu", "--window-size=1280,720"],
      },
    },
  ],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
  afterTest: async function (_test, _context, { error }) {
    if (!error) {
      return;
    }
    const safeTitle = _test.title.replace(/[^a-z0-9-]+/gi, "_").toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotDir = path.join(wdioArtifactsRoot, "screenshots");
    mkdirSync(screenshotDir, { recursive: true });
    const screenshotPath = path.join(screenshotDir, `${timestamp}-${safeTitle}.png`);
    await browser.saveScreenshot(screenshotPath);
  },
};

export default config;
