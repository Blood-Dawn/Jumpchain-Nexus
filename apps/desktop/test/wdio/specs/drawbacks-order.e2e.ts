/*
MIT License

Copyright (c) 2025 Bloodawn

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

const findNavButton = async (label: string) =>
  browser.$(`//span[@class="jmh-nav__label" and normalize-space(text())='${label}']/..`);

const planJumpButton = async () => {
  const startFirst = await browser.$("//button[contains(normalize-space(.),'Start First Jump')]");
  if (await startFirst.isExisting()) {
    return startFirst;
  }
  return browser.$("//button[contains(normalize-space(.),'Plan New Jump')]");
};

const activeJumpSelect = () => browser.$("//label[.//span[text()='Active Jump']]//select");

const drawbackNameInput = () =>
  browser.$("//form[contains(@class,'drawbacks__form')]//label[.//span[text()='Drawback Name']]//input");

const saveChangesButton = () =>
  browser.$("//form[contains(@class,'drawbacks__form')]//button[normalize-space()='Save Changes']");

const addDrawbackButton = () => browser.$("//button[normalize-space()='Add Drawback']");

const listItemNames = async () => {
  const items = await $$("aside.drawbacks__list li");
  const values: string[] = [];
  for (const item of items) {
    const nameNode = await item.$(".drawbacks__item-title strong");
    values.push(await nameNode.getText());
  }
  return values;
};

describe("Drawback Supplement ordering", () => {
  it("@integration persists reordering after navigation and reload", async () => {
    const now = Date.now();
    const universe = `WDIO Universe ${now}`;
    const jumpTitle = `WDIO Jump ${now}`;
    const origin = "Tester";
    const drawbackOne = `Alpha Drawback ${now}`;
    const drawbackTwo = `Beta Drawback ${now}`;

    await browser.url("/#/hub");

    const planButton = await planJumpButton();
    await planButton.waitForClickable({ timeout: 15000 });
    await planButton.click();

    const overlay = await browser.$(".onboarding-overlay");
    await overlay.waitForDisplayed({ timeout: 10000 });

    await (await browser.$("//label[contains(.,'Universe or Setting')]//input")).setValue(universe);
    await (await browser.$("//label[contains(.,'First Jump Title')]//input")).setValue(jumpTitle);
    await (await browser.$("//label[contains(.,'Origin')]//input")).setValue(origin);

    await (await browser.$("//button[normalize-space()='Create Jump']")).click();
    await overlay.waitForExist({ reverse: true, timeout: 15000 });

    await (await findNavButton("Drawback Supplement")).click();

    await browser.$("//h1[normalize-space()='Drawback Supplement']").waitForDisplayed({ timeout: 10000 });

    const jumpSelect = await activeJumpSelect();
    await jumpSelect.waitForDisplayed({ timeout: 10000 });
    await browser.waitUntil(
      async () => (await jumpSelect.getText()).includes(jumpTitle),
      {
        timeout: 10000,
        timeoutMsg: "Jump select never populated",
      }
    );
    await jumpSelect.selectByVisibleText(jumpTitle);

    await (await addDrawbackButton()).click();
    const nameField = await drawbackNameInput();
    await nameField.waitForDisplayed({ timeout: 10000 });
    await nameField.setValue(drawbackOne);
    await (await saveChangesButton()).click();
    await browser.pause(250);

    await (await addDrawbackButton()).click();
    await nameField.waitForDisplayed({ timeout: 10000 });
    await nameField.setValue(drawbackTwo);
    await (await saveChangesButton()).click();

    await browser.waitUntil(async () => (await listItemNames()).length >= 2, {
      timeout: 10000,
      timeoutMsg: "Expected two drawbacks to be listed",
    });

    expect(await listItemNames()).to.deep.equal([drawbackOne, drawbackTwo]);

    await browser.$(`//button[@aria-label='Move ${drawbackOne} later']`).click();
    await browser.waitUntil(
      async () => {
        const names = await listItemNames();
        return names[0] === drawbackTwo && names[1] === drawbackOne;
      },
      { timeout: 5000, timeoutMsg: "Drawback order did not update" }
    );

    const saveOrderButton = await browser.$(
      "//div[contains(@class,'drawbacks__order-controls')]//button[normalize-space()='Save Order']"
    );
    await saveOrderButton.waitForEnabled({ timeout: 5000 });
    await saveOrderButton.click();
    await browser.$("//button[normalize-space()='Saving Order…']").waitForExist({ reverse: true, timeout: 10000 });

    expect(await listItemNames()).to.deep.equal([drawbackTwo, drawbackOne]);

    await (await findNavButton("Cosmic Warehouse")).click();
    await browser.$("//h1[normalize-space()='Cosmic Warehouse']").waitForDisplayed({ timeout: 10000 });

    await (await findNavButton("Drawback Supplement")).click();
    await browser.$("//h1[normalize-space()='Drawback Supplement']").waitForDisplayed({ timeout: 10000 });
    expect(await listItemNames()).to.deep.equal([drawbackTwo, drawbackOne]);

    await browser.refresh();
    await browser.$("//h1[normalize-space()='Drawback Supplement']").waitForDisplayed({ timeout: 10000 });
    await browser.waitUntil(async () => (await listItemNames()).length >= 2, {
      timeout: 10000,
      timeoutMsg: "Drawbacks did not repopulate after reload",
    });
    expect(await listItemNames()).to.deep.equal([drawbackTwo, drawbackOne]);
  });
});

