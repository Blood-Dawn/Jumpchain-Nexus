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

/// <reference types="vitest" />

import { describe, expect, it } from "vitest";
import { computeBudget, type PurchaseCostInput } from "./dao";

describe("computeBudget", () => {
  it("aggregates normal purchases", () => {
    const purchases: PurchaseCostInput[] = [
      { cost: 200 },
      { cost: 50 },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 250,
      discounted: 0,
      freebies: 0,
      netCost: 250,
    });
  });

  it("halves discounted purchases", () => {
    const purchases: PurchaseCostInput[] = [
      { cost: 100, discount: true },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 100,
      discounted: 100,
      freebies: 0,
      netCost: 50,
    });
  });

  it("ignores freebies from net cost", () => {
    const purchases: PurchaseCostInput[] = [
      { cost: 350, freebie: true },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 350,
      discounted: 0,
      freebies: 350,
      netCost: 0,
    });
  });

  it("handles mixed purchases", () => {
    const purchases: PurchaseCostInput[] = [
      { cost: 200 },
      { cost: 150, discount: true },
      { cost: 75, freebie: true },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 425,
      discounted: 150,
      freebies: 75,
      netCost: 275,
    });
  });
});
