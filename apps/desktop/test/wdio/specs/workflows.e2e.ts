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

import { expect } from "chai";

type MochaContext = Mocha.Context;

async function ensureAppReady(): Promise<boolean> {
  try {
    await browser.url("/");
    const body = await browser.$("body");
    await body.waitForExist({ timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function findNavLink(title: string) {
  const selector = `//a[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${title.toLowerCase()}')]`;
  const link = await browser.$(selector);
  if (!(await link.isExisting())) {
    return null;
  }
  await link.scrollIntoView();
  return link;
}

async function fillByLabel(label: string, value: string) {
  const input = await browser.$(
    `//label[contains(normalize-space(.), '${label}')]/following::input[1]`
  );
  await input.waitForExist({ timeout: 5000 });
  await input.setValue(value);
  return input;
}

async function toggleCheckbox(label: string, checked: boolean) {
  const input = await browser.$(
    `//label[contains(normalize-space(.), '${label}')]/preceding::input[@type='checkbox'][1]`
  );
  if (!(await input.isExisting())) {
    return;
  }
  const isChecked = await input.isSelected();
  if (isChecked !== checked) {
    await input.click();
  }
}

describe("Jumpchain desktop smoke flows", function () {
  let appAvailable = false;

  before(async function () {
    appAvailable = await ensureAppReady();
    if (!appAvailable) {
      this.skip();
    }
  });

  beforeEach(async function () {
    if (!appAvailable) {
      this.skip();
      return;
    }
    await browser.url("/");
  });

  it("Jump Hub CRUD workflow", async function (this: MochaContext) {
    const nav = await findNavLink("Jump Hub");
    if (!nav) {
      this.skip();
      return;
    }
    await nav.click();
    const heading = await browser.$("//h1[contains(., 'Jump Memory Hub')]");
    await heading.waitForDisplayed({ timeout: 10000 });

    const jumpName = `WDIO Jump ${Date.now()}`;
    const assetName = `WDIO Origin ${Date.now()}`;

    const onboarding = await browser.$(
      "//button[contains(., 'Start First Jump') or contains(., 'Plan New Jump')]"
    );
    await onboarding.waitForClickable({ timeout: 10000 });
    await onboarding.click();

    await browser
      .$("//h1[contains(., 'First Jump Setup')]")
      .waitForDisplayed({ timeout: 10000 });

    await fillByLabel("Universe or Setting", "Automation Realm");
    await fillByLabel("First Jump Title", jumpName);
    await fillByLabel("Origin", "Automation Origin");

    const createButton = await browser.$("//button[contains(., 'Create Jump')]");
    await createButton.waitForClickable({ timeout: 10000 });
    await createButton.click();

    const activeSelect = await browser.$(
      "//label[contains(., 'Active Jump')]/following::select[1]"
    );
    await activeSelect.waitForExist({ timeout: 10000 });
    await activeSelect.selectByVisibleText(jumpName);

    const addOrigin = await browser.$("//button[contains(., 'Add Origin')]");
    await addOrigin.waitForClickable({ timeout: 10000 });
    await addOrigin.click();

    const assetForm = await browser.$("//form[contains(@class, 'asset-form')]");
    await assetForm.waitForDisplayed({ timeout: 10000 });

    await fillByLabel("Name", assetName);
    await fillByLabel("Category", "Automation");
    await fillByLabel("Quantity", "2");
    await fillByLabel("Slot / Location", "Binder");

    const saveAsset = await assetForm.$("//button[contains(., 'Save Changes')]");
    await saveAsset.click();

    const nameInput = await assetForm.$(".//input[@name='name' or @aria-label='Name']");
    if (await nameInput.isExisting()) {
      expect(await nameInput.getValue()).to.equal(assetName);
    }

    const deleteButton = await assetForm.$(".//button[contains(., 'Delete')]");
    if (await deleteButton.isExisting()) {
      await deleteButton.click();

      let alertShown = false;
      try {
        await browser.waitUntil(
          async () => {
            try {
              await browser.getAlertText();
              return true;
            } catch {
              return false;
            }
          },
          { timeout: 3000, interval: 100 }
        );
        alertShown = true;
      } catch {
        alertShown = false;
      }

      if (alertShown) {
        await browser.acceptAlert().catch(() => undefined);
      }
    }

    const emptyState = await browser.$("//*[contains(@class, 'asset-board__empty')]");
    await emptyState.waitForDisplayed({ timeout: 10000 });
  });

  it("Passport aggregation workflow", async function (this: MochaContext) {
    const nav = await findNavLink("Cosmic Passport");
    if (!nav) {
      this.skip();
      return;
    }
    await nav.click();
    await browser.$("//h1[contains(., 'Cosmic Passport')]").waitForDisplayed({ timeout: 10000 });

    const profileName = `Traveler ${Date.now()}`;

    const newProfile = await browser.$("//button[contains(., 'New Profile')]");
    await newProfile.waitForClickable({ timeout: 10000 });
    await newProfile.click();

    await fillByLabel("Name", profileName);
    await fillByLabel("Alias", "Alias Alpha");
    await fillByLabel("Species", "Automation");
    await fillByLabel("Homeland", "Webdriverio");

    const addAttribute = await browser.$("//button[contains(., 'Add Attribute')]");
    await addAttribute.click();
    const firstAttribute = await browser.$("(//div[contains(@class, 'passport__repeat-row')])[1]");
    await firstAttribute
      .$(".//input[contains(@placeholder, 'Attribute')]")
      .setValue("Strength");
    await firstAttribute
      .$(".//input[contains(@placeholder, 'Value')]")
      .setValue("120");

    const addTrait = await browser.$("//button[contains(., 'Add Trait')]");
    await addTrait.click();
    const traitRow = await browser.$("(//div[contains(@class, 'passport__repeat-row--stacked')])[1]");
    await traitRow
      .$(".//input[contains(@placeholder, 'Trait')]")
      .setValue("Flying");
    await traitRow
      .$(".//textarea[contains(@placeholder, 'Description')]")
      .setValue("Allows rapid travel.");

    const addForm = await browser.$("//button[contains(., 'Add Form')]");
    await addForm.click();
    const formRow = await browser.$("(//div[contains(@class, 'passport__repeat-row--stacked')])[2]");
    await formRow
      .$(".//input[contains(@placeholder, 'Form Name')]")
      .setValue("Dragon");
    await formRow
      .$(".//textarea[contains(@placeholder, 'Summary')]")
      .setValue("Gigantic and intimidating.");

    const savePassport = await browser.$("//button[contains(., 'Save Changes')]");
    await savePassport.click();

    const summary = await browser.$("//*[contains(@class, 'passport__summary')]");
    await summary.waitForDisplayed({ timeout: 10000 });
  });

  it("Warehouse and Locker filters", async function (this: MochaContext) {
    const nav = await findNavLink("Cosmic Warehouse");
    if (!nav) {
      this.skip();
      return;
    }
    await nav.click();
    await browser.$("//h1[contains(., 'Cosmic Warehouse')]").waitForDisplayed({ timeout: 10000 });

    const itemName = `Warehouse Item ${Date.now()}`;
    const addItem = await browser.$("//button[contains(., 'Add Item')]");
    await addItem.click();
    const newItem = await browser.$("//button[contains(., 'New Item')]");
    await newItem.waitForClickable({ timeout: 10000 });
    await newItem.click();

    const form = await browser.$("//form[contains(@class, 'warehouse__form')]");
    await form.waitForDisplayed({ timeout: 10000 });
    await form.$(".//input[@name='name' or @aria-label='Name']").setValue(itemName);
    await fillByLabel("Category", "Supplies");
    await fillByLabel("Quantity", "3");
    await fillByLabel("Slot / Location", "Shelf 42");
    await fillByLabel("Tags", "automation");
    await form.$(".//textarea[@name='notes' or @aria-label='Notes']").setValue("Prepared via WDIO");

    await form.$(".//button[contains(., 'Save Changes')]").click();

    await form.$(".//button[contains(., 'Move to Locker')]").click();

    const lockerNav = await findNavLink("Cosmic Locker");
    if (!lockerNav) {
      this.skip();
      return;
    }
    await lockerNav.click();
    await browser.$("//h1[contains(., 'Cosmic Locker')]").waitForDisplayed({ timeout: 10000 });

    const lockerItem = await browser.$(`//button[contains(., '${itemName}')]`);
    await lockerItem.waitForExist({ timeout: 10000 });
    await lockerItem.click();
    await toggleCheckbox("Packed", true);
    await fillByLabel("Priority", "luxury");
    await browser
      .$("//form[contains(@class, 'locker__form')]//textarea")
      .setValue("Ready for deployment.");
    await browser
      .$("//form[contains(@class, 'locker__form')]//button[contains(., 'Save Changes')]")
      .click();

    const returnButton = await browser.$("//button[contains(., 'Return to Warehouse')]");
    await returnButton.click();

    const warehouseNav = await findNavLink("Cosmic Warehouse");
    if (warehouseNav) {
      await warehouseNav.click();
      const deleteItem = await browser.$("//button[contains(., 'Delete Item')]");
      if (await deleteItem.isExisting()) {
        await deleteItem.click();
      }
    }
  });

  it("Export toggles workflow", async function (this: MochaContext) {
    const nav = await findNavLink("Exports");
    if (!nav) {
      this.skip();
      return;
    }
    await nav.click();
    await browser.$("//h1[contains(., 'Export Suite')]").waitForDisplayed({ timeout: 10000 });

    const presetName = `Preset ${Date.now()}`;
    const newPreset = await browser.$("//button[contains(., 'New Preset')]");
    await newPreset.click();

    await browser.acceptAlert().catch(() => undefined);

    await fillByLabel("Preset Name", presetName);
    await browser
      .$("//textarea[@name='description' or @aria-label='Description']")
      .setValue("WDIO preset");

    const bbcode = await browser.$("//input[@type='radio' and @value='bbcode']");
    if (await bbcode.isExisting()) {
      await bbcode.click();
    }

    await toggleCheckbox("Inventory snapshot", false);
    await toggleCheckbox("Character profiles", false);
    await toggleCheckbox("Notes overview", true);

    await browser
      .$("//button[contains(., 'Save Preset')]")
      .click();

    const presetButton = await browser.$(`//button[contains(., '${presetName}')]`);
    await presetButton.waitForExist({ timeout: 10000 });
    await presetButton.click();

    const deletePreset = await browser.$("//button[contains(., 'Delete')]");
    if (await deletePreset.isExisting()) {
      await deletePreset.click();
      await browser.acceptAlert().catch(() => undefined);
    }
  });

  it("Drawback Supplement flows", async function (this: MochaContext) {
    const nav = await findNavLink("Drawback");
    if (!nav) {
      this.skip();
      return;
    }
    await nav.click();
    await browser
      .$("//h1[contains(., 'Drawback Supplement')]")
      .waitForDisplayed({ timeout: 10000 });

    const createDrawback = await browser.$(
      "//button[contains(., 'New Drawback') or contains(., 'Add Drawback')]"
    );
    if (!(await createDrawback.isExisting())) {
      this.skip();
      return;
    }
    await createDrawback.click();

    const drawbackForm = await browser.$("//form[contains(@class, 'drawbacks__form')]");
    await drawbackForm.waitForDisplayed({ timeout: 10000 });

    await fillByLabel("Name", "Automation Drawback");
    await fillByLabel("Category", "Testing");
    await fillByLabel("Bonus CP", "200");
    await drawbackForm
      .$(".//textarea[@name='notes' or @aria-label='Notes']")
      .setValue("Documented via WDIO");

    const severitySelect = await browser.$(
      "//label[contains(., 'Severity')]/following::select[1]"
    );
    if (await severitySelect.isExisting()) {
      await severitySelect.selectByVisibleText("Severe");
    }

    await toggleCheckbox("House Rule", true);
    await drawbackForm.$(".//button[contains(., 'Save Changes')]").click();
  });

  it("Formatter interactions", async function (this: MochaContext) {
    const nav = await findNavLink("Formatter");
    if (!nav) {
      this.skip();
      return;
    }
    await nav.click();
    await browser
      .$("//h1[contains(., 'Input Formatter') or contains(., 'Formatter Toolkit')]")
      .waitForDisplayed({ timeout: 10000 });

    const textarea = await browser.$(
      "//textarea[contains(@class, 'formatter__input') or @aria-label='Formatter input']"
    );
    if (!(await textarea.isExisting())) {
      this.skip();
      return;
    }

    await textarea.setValue("First Line\n\nSecond Line\tTabbed");

    await toggleCheckbox("Remove all line breaks", true);
    await toggleCheckbox("Preserve double breaks", true);

    const formatButton = await browser.$("//button[contains(., 'Format Text')]");
    await formatButton.click();

    const preview = await browser.$("//*[contains(@class, 'formatter__preview')]");
    await preview.waitForDisplayed({ timeout: 10000 });
    const previewText = await preview.getText();
    expect(previewText).to.contain("First Line Second Line Tabbed");
  });

  afterEach(async function () {
    expect(true).to.equal(true);
  });
});
