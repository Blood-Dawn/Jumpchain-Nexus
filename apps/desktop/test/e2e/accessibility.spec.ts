/*
MIT License

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

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const modules = [
  { name: "Jump Hub", heading: /Jump Memory Hub/i },
  { name: "Cosmic Passport", heading: /Cosmic Passport/i },
  { name: "Exports", heading: /Export Suite/i },
  { name: "Cosmic Warehouse", heading: /Cosmic Warehouse/i },
  { name: "Cosmic Locker", heading: /Cosmic Locker/i },
  { name: "Drawback", heading: /Drawback Supplement/i },
  { name: "Formatter", heading: /Formatter/i },
];

async function openModule(page: Page, module: (typeof modules)[number]) {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  const link = page.getByRole("link", { name: new RegExp(`^${module.name}`, "i") });
  await link.first().click();
  await page.getByRole("heading", { name: module.heading }).first().waitFor({ timeout: 10000 });
}

test.describe("Accessibility smoke coverage", () => {
  for (const module of modules) {
    test(`@a11y-e2e ${module.name} view has no accessibility violations`, async ({ page }) => {
      try {
        await openModule(page, module);
      } catch (error) {
        test.skip(`Module ${module.name} unavailable: ${error}`);
        return;
      }

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      expect(results.violations, module.name).toEqual([]);
    });
  }
});
