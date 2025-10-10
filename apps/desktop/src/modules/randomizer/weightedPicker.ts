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

export interface WeightedEntry<T = unknown> {
  id: string;
  weight: number;
  payload: T;
}

function isValidWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function drawWeightedWithoutReplacement<T>(
  entries: WeightedEntry<T>[],
  count: number,
  rng: () => number = Math.random
): WeightedEntry<T>[] {
  if (!Array.isArray(entries) || !entries.length || count <= 0) {
    return [];
  }
  const pool = entries.filter((entry) => isValidWeight(entry.weight)).map((entry) => ({ ...entry }));
  const limit = Math.min(count, pool.length);
  const results: WeightedEntry<T>[] = [];

  for (let pick = 0; pick < limit; pick += 1) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (!isValidWeight(totalWeight)) {
      break;
    }
    const roll = rng() * totalWeight;
    let threshold = roll;
    let selectedIndex = pool.length - 1;

    for (let index = 0; index < pool.length; index += 1) {
      threshold -= pool[index]!.weight;
      if (threshold <= 0) {
        selectedIndex = index;
        break;
      }
    }

    const [selected] = pool.splice(selectedIndex, 1);
    if (!selected) {
      break;
    }
    results.push(selected);
  }

  return results;
}
