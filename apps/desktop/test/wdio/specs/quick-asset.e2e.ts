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

import { expect } from "@wdio/globals";

describe("Jump Hub quick asset editor", () => {
  it("@smoke supports creating, editing, and tagging assets from the overview", async () => {
    await browser.url("/");

    const jumpHubLink = await $("role=link[name^='Jump Hub']");
    if (await jumpHubLink.isExisting()) {
      await jumpHubLink.click();
    } else {
      const fallbackLink = await $("=Jump Hub");
      if (await fallbackLink.isExisting()) {
        await fallbackLink.click();
      }
    }

    const newJumpButton = await $(".jump-hub__cta");
    await newJumpButton.waitForDisplayed();
    await newJumpButton.click();

    const jumpName = `WDIO Jump ${Date.now()}`;
    const originName = `WDIO Origin ${Date.now()}`;

    const titleInput = await $("//form[contains(@class,'jump-hub__form')]//label[.//span[text()='Jump Title']]//input");
    await titleInput.setValue(jumpName);
    const universeInput = await $("//form[contains(@class,'jump-hub__form')]//label[.//span[text()='Universe']]//input");
    await universeInput.setValue("WDIO Testing Grounds");
    const budgetInput = await $("//form[contains(@class,'jump-hub__form')]//label[.//span[text()='CP Budget']]//input");
    await budgetInput.setValue("1200");

    const createButton = await $("//form[contains(@class,'jump-hub__form')]//button[@type='submit']");
    await createButton.click();

    const jumpCard = await $(".jump-hub__card");
    await jumpCard.waitForDisplayed();
    const toggle = await jumpCard.$(".jump-hub__card-toggle");
    await toggle.click();

    const [originAddButton] = await $$('[data-testid="quick-asset-add"]');
    await originAddButton.waitForDisplayed();
    await originAddButton.click();

    const nameInput = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Name']]//input");
    await nameInput.waitForDisplayed();
    await nameInput.setValue(originName);

    const categoryInput = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Category']]//input");
    await categoryInput.setValue("Test");
    const costInput = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Cost']]//input");
    await costInput.setValue("150");
    const quantityInput = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Quantity']]//input");
    await quantityInput.setValue("2");

    const discountedToggle = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Discounted']]//input");
    await discountedToggle.click();

    const tagInput = await $('[data-testid="quick-asset-tag-input"]');
    await tagInput.setValue("Arcane");
    await browser.keys("Enter");

    const stipendBase = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Base CP']]//input");
    await stipendBase.setValue("75");
    const stipendFrequency = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Frequency']]//select");
    await stipendFrequency.selectByAttribute("value", "monthly");
    const stipendPeriods = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Periods']]//input");
    await stipendPeriods.setValue("4");

    const notesArea = await $("//section[contains(@class,'quick-asset')]//label[.//span[text()='Notes']]//textarea");
    await notesArea.setValue("Tagged via WebdriverIO smoke test.");

    const saveButton = await $('[data-testid="quick-asset-save"]');
    await saveButton.click();

    await expect($(".quick-asset__status--success")).toHaveTextContaining("Saved");
    await expect($(".quick-asset__tag")).toHaveTextContaining("Arcane");
    await expect($(".quick-asset__stipend-total")).toHaveTextContaining("300");
  });
});
