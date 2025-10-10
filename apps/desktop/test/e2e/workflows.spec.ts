/*
MIT License

Copyright (c) 2025 Age-Of-Ages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to do so, subject to the
following conditions:

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

import { expect, test } from "@playwright/test";

const navLink = (page: typeof test[""]["page"], title: string) =>
  page.getByRole("link", { name: new RegExp(`^${title}\\b`, "i") });

test.describe("Jumpchain desktop workflows", () => {
  test.describe.configure({ mode: "serial" });

  test("@smoke Jump Hub supports full CRUD", async ({ page }) => {
    await page.goto("/");
    await navLink(page, "Jump Hub").click();
    await expect(page.getByRole("heading", { name: "Jump Memory Hub" })).toBeVisible();

    const jumpName = `Playwright Jump ${Date.now()}`;
    const assetName = `Origin ${Date.now()}`;

    const onboardingToggle = page
      .getByRole("button", { name: /Start First Jump|Plan New Jump/ })
      .first();
    await onboardingToggle.click();

    await expect(page.getByRole("heading", { name: "Jumpchain Nexus: First Jump Setup" })).toBeVisible();
    await page.getByLabel("Universe or Setting").fill("Playwright Testing Grounds");
    await page.getByLabel("First Jump Title").fill(jumpName);
    await page.getByLabel("Origin").fill("Test Origin");
    await page.getByRole("button", { name: "Create Jump" }).click();
    await page.locator(".onboarding-overlay").waitFor({ state: "hidden" });

    const activeJumpSelect = page.getByRole("combobox", { name: "Active Jump" });
    await expect(activeJumpSelect).toContainText(jumpName);
    await activeJumpSelect.selectOption({ label: jumpName });

    const addOriginButton = page.getByRole("button", { name: "Add Origin" });
    await addOriginButton.click();

    const nameInput = page.getByLabel("Name", { exact: true });
    await expect(nameInput).toHaveValue("New Origin");
    await nameInput.fill(assetName);
    await page.getByLabel("Category").fill("Playtest");
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel("Slot / Location").fill("Binder 7");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(nameInput).toHaveValue(assetName);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /^Delete$/ }).click();
    await expect(page.locator(".asset-board__empty")).toHaveText(/No origins recorded yet/i);

    const removalResult = await page.evaluate(async ({ jumpTitle }) => {
      try {
        const { default: Database } = await import("@tauri-apps/plugin-sql");
        const db = await Database.load("sqlite:app.db");
        const rows = await db.select<{ id: string }[]>("SELECT id FROM jumps WHERE title = $1", [jumpTitle]);
        if (!rows.length) {
          return false;
        }
        const jumpId = rows[0].id;
        await db.execute("DELETE FROM jump_assets WHERE jump_id = $1", [jumpId]);
        await db.execute("DELETE FROM next_actions WHERE jump_id = $1", [jumpId]);
        await db.execute("DELETE FROM notes WHERE jump_id = $1", [jumpId]);
        await db.execute("DELETE FROM jumps WHERE id = $1", [jumpId]);
        return true;
      } catch (error) {
        console.error("Failed to delete jump during cleanup", error);
        return false;
      }
    }, { jumpTitle: jumpName });

    expect(removalResult).toBe(true);
    await page.reload();
    await navLink(page, "Jump Hub").click();
    await expect(page.getByRole("combobox", { name: "Active Jump" })).not.toContainText(jumpName);
  });

  test("@smoke Passport aggregates companions", async ({ page }) => {
    await page.goto("/");
    await navLink(page, "Cosmic Passport").click();
    await expect(page.getByRole("heading", { name: "Cosmic Passport" })).toBeVisible();

    const profileName = `Traveler ${Date.now()}`;
    await page.getByRole("button", { name: "New Profile" }).click();
    await expect(page.getByLabel("Name")).toBeVisible();
    await page.getByLabel("Name").fill(profileName);
    await page.getByLabel("Alias").fill("Alias Alpha");
    await page.getByLabel("Species").fill("Test Species");
    await page.getByLabel("Homeland").fill("Playwrightia");

    await page.getByRole("button", { name: "Add Attribute" }).click();
    const attributeRow = page.locator(".passport__repeat-row").first();
    await attributeRow.getByPlaceholder("Attribute").fill("Strength");
    await attributeRow.getByPlaceholder("Value").fill("150");

    await page.getByRole("button", { name: "Add Trait" }).click();
    const traitRow = page.locator(".passport__repeat-row--stacked").first();
    await traitRow.getByPlaceholder("Trait").fill("Flying");
    await traitRow.getByPlaceholder("Description").fill("Allows rapid travel.");

    await page.getByRole("button", { name: "Add Form" }).click();
    const formRow = page.locator(".passport__repeat-row--stacked").nth(1);
    await formRow.getByPlaceholder("Form Name").fill("Dragon");
    await formRow.getByPlaceholder("Summary").fill("Gigantic and intimidating.");

    await page.getByRole("button", { name: "Save Changes" }).click();

    const summary = page.locator(".passport__summary");
    await expect(summary.locator("div", { hasText: "Attribute Sum" }).locator("span")).toHaveText("150");
    await expect(summary.locator("div", { hasText: "Average Score" }).locator("span")).toHaveText("150");
    await expect(summary.locator("div", { hasText: "Alt Forms" }).locator("span")).toHaveText("1");
    await expect(summary.locator("div", { hasText: "Traits" }).locator("span")).toHaveText("1");

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator(".passport__empty")).toHaveText(/select or create a profile/i);
  });

  test("@smoke Export presets can be saved and reused", async ({ page }) => {
    await page.goto("/");
    await navLink(page, "Exports").click();
    await expect(page.getByRole("heading", { name: "Export Suite" })).toBeVisible();

    const presetName = `Preset ${Date.now()}`;
    page.once("dialog", (dialog) => dialog.accept(presetName));
    await page.getByRole("button", { name: "New Preset" }).click();

    await expect(page.getByLabel("Preset Name")).toHaveValue(presetName);
    await page.getByLabel("Description").fill("Playwright smoke preset");
    await page.getByRole("radio", { name: "BBCode" }).check();
    await page.getByLabel("Inventory snapshot").uncheck();
    await page.getByLabel("Character profiles").uncheck();
    await page.getByLabel("Include Notes").check({ force: true }); // fallback in case label differs
    await page.getByLabel("Include Notes", { exact: false }).check();
    await page.getByRole("button", { name: "Save Preset" }).click();
    await expect(page.getByText("Preset saved.")).toBeVisible();

    await page.reload();
    await navLink(page, "Exports").click();
    const presetButton = page.getByRole("button", { name: new RegExp(`^${presetName}`) });
    await presetButton.click();
    await expect(page.getByLabel("Preset Name")).toHaveValue(presetName);
    await expect(page.getByLabel("Description")).toHaveValue("Playwright smoke preset");
    await expect(page.getByRole("radio", { name: "BBCode" })).toBeChecked();
    await expect(page.getByLabel("Inventory snapshot")).not.toBeChecked();
    await expect(page.getByLabel("Include Notes", { exact: false })).toBeChecked();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Preset deleted.")).toBeVisible();
  });

  test("@smoke Warehouse and Locker manage inventory", async ({ page }) => {
    await page.goto("/");
    await navLink(page, "Cosmic Warehouse").click();
    await expect(page.getByRole("heading", { name: "Cosmic Warehouse" })).toBeVisible();

    const itemName = `Warehouse Item ${Date.now()}`;
    await page.getByRole("button", { name: "Add Item" }).click();
    const listItem = page.getByRole("listitem").filter({ hasText: "New Item" }).first();
    await listItem.click();

    await page.getByLabel("Name").fill(itemName);
    await page.getByLabel("Category").fill("Supplies");
    await page.getByLabel("Quantity").fill("3");
    await page.getByLabel("Slot / Location").fill("Shelf 9");
    await page.getByLabel("Tags").fill("test, smoke");
    await page.getByLabel("Notes").fill("Prepared via Playwright.");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByLabel("Name")).toHaveValue(itemName);

    await page.getByRole("button", { name: "Move to Locker" }).click();
    await expect(page.getByRole("list")).not.toContainText(itemName);

    await navLink(page, "Cosmic Locker").click();
    await expect(page.getByRole("heading", { name: "Cosmic Locker" })).toBeVisible();
    const lockerItem = page.getByRole("listitem").filter({ hasText: itemName }).first();
    await lockerItem.click();
    await lockerItem.getByLabel("Packed").check();
    await page.getByLabel("Priority").selectOption("luxury");
    await page.getByLabel("Notes").fill("Ready for deployment.");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByLabel("Priority")).toHaveValue("luxury");

    await page.getByRole("button", { name: "Return to Warehouse" }).click();
    await expect(page.getByRole("list")).not.toContainText(itemName);

    await navLink(page, "Cosmic Warehouse").click();
    await expect(page.getByRole("list")).toContainText(itemName);
    await page.getByRole("listitem", { name: new RegExp(itemName) }).click();
    await page.getByRole("button", { name: "Delete Item" }).click();
    await expect(page.getByRole("list")).not.toContainText(itemName);
  });
});
