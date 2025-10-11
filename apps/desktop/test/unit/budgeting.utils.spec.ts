import { describe, expect, it } from "vitest";
import { computeBudget, type PurchaseCostInput } from "../../src/db/dao";

describe("budgeting utilities", () => {
  it("aggregates large purchase sets without precision drift", () => {
    const purchases: PurchaseCostInput[] = Array.from({ length: 100 }, (_, index) => ({
      cost: (index + 1) * 10,
      discount: index % 3 === 0,
      freebie: index % 10 === 0,
    }));

    const summary = computeBudget(purchases);
    expect(summary.totalCost).toBe(50500);
    expect(summary.freebies).toBe(4600);
    expect(summary.discounted).toBe(15330);
    expect(summary.netCost).toBe(38235);
  });

  it("treats discounted freebies as freebies", () => {
    const purchases: PurchaseCostInput[] = [
      { cost: 400, discount: true, freebie: true },
      { cost: 200, discount: true },
      { cost: 100, freebie: true },
    ];

    const summary = computeBudget(purchases);
    expect(summary.totalCost).toBe(700);
    expect(summary.discounted).toBe(200);
    expect(summary.freebies).toBe(500);
    expect(summary.netCost).toBe(100);
  });
});
