/*
Bloodawn

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

export type ThousandsSeparatorOption = "none" | "comma" | "period" | "space";

export const THOUSANDS_SEPARATOR_CHOICES = [
  { value: "none", label: "None" },
  { value: "comma", label: "Comma (1,000)" },
  { value: "period", label: "Period (1.000)" },
  { value: "space", label: "Space (1 000)" },
] satisfies ReadonlyArray<{ value: ThousandsSeparatorOption; label: string }>;

export interface TextFormatterOptions {
  removeAllLineBreaks: boolean;
  leaveDoubleLineBreaks: boolean;
  xmlSafe?: boolean;
}

const XML_UNSAFE_PATTERN = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g;

const EXCESS_SPACES_PATTERN = /[ \t]{2,}/g;
const PARAGRAPH_START_SPACE_PATTERN = /(?<=\n) /g;

/**
 * Normalizes newline sequences to a single line-feed character to simplify downstream regex logic.
 */
function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?/g, "\n");
}

function stripLineBreaks(input: string, options: TextFormatterOptions): string {
  const normalized = normalizeNewlines(input);

  if (options.removeAllLineBreaks) {
    return normalized.replace(/\n+/g, " ");
  }

  if (options.leaveDoubleLineBreaks) {
    return normalized.replace(/\n+/g, (match) => (match.length >= 2 ? "\n\n" : " "));
  }

  // Default behaviour mirrors the legacy regex: replace any newline that is not followed by another newline.
  return normalized.replace(/\n(?!\n)/g, " ");
}

function stripExcessSpaces(input: string): string {
  const withoutRuns = input.replace(EXCESS_SPACES_PATTERN, " ");
  return withoutRuns.replace(PARAGRAPH_START_SPACE_PATTERN, "");
}

function stripXmlUnsafe(input: string): string {
  return input.replace(XML_UNSAFE_PATTERN, "");
}

export function formatInputText(input: string, options: TextFormatterOptions): string {
  if (!input.length) {
    return "";
  }

  const stepOne = stripLineBreaks(input, options);
  const stepTwo = stripExcessSpaces(stepOne);
  const cleaned = options.xmlSafe !== false ? stripXmlUnsafe(stepTwo) : stepTwo;

  return cleaned.trim();
}

export function formatBudget(value: number, format: ThousandsSeparatorOption): string {
  const normalized = Number.isFinite(value) ? value : 0;
  const localeOptions: Record<ThousandsSeparatorOption, string> = {
    none: "",
    comma: ",",
    period: ".",
    space: " ",
  };

  const groupSeparator = localeOptions[format] ?? "";

  if (!groupSeparator) {
    return Math.trunc(normalized).toString();
  }

  const formatter = new Intl.NumberFormat(undefined, {
    useGrouping: true,
    maximumFractionDigits: 0,
  });

  const raw = formatter.format(Math.trunc(normalized));

  // Replace default grouping separator with the configured one (Intl may default to locale specific chars).
  if (groupSeparator === ",") {
    return raw;
  }

  const separatorMatch = raw.replace(/^-?/, "").match(/[^0-9]/);
  const defaultSeparator = separatorMatch ? separatorMatch[0] : ",";
  return raw.split(defaultSeparator).join(groupSeparator);
}
