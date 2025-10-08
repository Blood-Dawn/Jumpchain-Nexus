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

import { Command } from "@tauri-apps/plugin-shell";

export type GrammarMode = "remote" | "sidecar";

export interface GrammarRule {
  id: string;
  category: string;
  description: string;
  issueType: string;
}

export interface GrammarReplacement {
  value: string;
}

export interface GrammarSuggestion {
  id: string;
  message: string;
  shortMessage: string;
  replacements: GrammarReplacement[];
  offset: number;
  length: number;
  rule: GrammarRule;
  sentence: string;
}

export interface GrammarCheckResult {
  mode: GrammarMode;
  matches: GrammarSuggestion[];
  language: string;
}

export interface GrammarCheckOptions {
  language?: string;
  motherTongue?: string;
  enabledRules?: string[];
  disabledRules?: string[];
  mode: GrammarMode;
}

interface LanguageToolResponse {
  matches: Array<{
    message: string;
    shortMessage: string;
    replacements: Array<{ value: string }>;
    offset: number;
    length: number;
    sentence: string;
    rule: {
      id: string;
      description: string;
      issueType: string;
      category?: {
        id: string;
        name: string;
      };
    };
  }>;
  language: {
    detectedLanguage: {
      code: string;
    };
  };
}

const REMOTE_ENDPOINT = "https://api.languagetool.org/v2/check";
const SIDECAR_DEFAULT_PORT = 24080;

let sidecarPort = SIDECAR_DEFAULT_PORT;
let sidecarProcess: Awaited<ReturnType<typeof Command.prototype.spawn>> | null = null;
let sidecarReady: Promise<void> | null = null;

async function waitForHealth(port: number, retries = 15): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        return;
      }
    } catch (error) {
      if (attempt >= retries - 1) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

export async function ensureSidecarRunning(port = SIDECAR_DEFAULT_PORT): Promise<number> {
  if (sidecarProcess) {
    return sidecarPort;
  }
  sidecarPort = port;
  const command = Command.sidecar("languagetool-proxy", ["--port", String(port)]);
  command.stdout.on("data", (line: string) => {
    console.debug(`[lt-sidecar] ${line}`);
  });
  command.stderr.on("data", (line: string) => {
    console.warn(`[lt-sidecar] ${line}`);
  });
  sidecarProcess = await command.spawn();
  sidecarReady = waitForHealth(port).catch((error) => {
    console.error("LanguageTool sidecar failed to start", error);
    throw error;
  });
  await sidecarReady;
  return port;
}

export async function shutdownSidecar(): Promise<void> {
  if (!sidecarProcess) return;
  try {
    await sidecarProcess.kill();
  } catch (error) {
    console.warn("Failed to stop LanguageTool sidecar", error);
  } finally {
    sidecarProcess = null;
    sidecarReady = null;
  }
}

function mapMatches(payload: LanguageToolResponse): GrammarSuggestion[] {
  return payload.matches.map((match, index) => ({
    id: `${match.rule.id}-${match.offset}-${index}`,
    message: match.message,
    shortMessage: match.shortMessage,
    replacements: match.replacements,
    offset: match.offset,
    length: match.length,
    sentence: match.sentence,
    rule: {
      id: match.rule.id,
      description: match.rule.description,
      issueType: match.rule.issueType,
      category: match.rule.category?.name ?? "General",
    },
  }));
}

async function requestGrammar(url: string, body: URLSearchParams): Promise<GrammarSuggestion[]> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LanguageTool returned ${response.status}: ${text}`);
  }
  const payload = (await response.json()) as LanguageToolResponse;
  return mapMatches(payload);
}

export async function checkGrammar(
  text: string,
  options: GrammarCheckOptions
): Promise<GrammarCheckResult> {
  const language = options.language ?? "en-US";
  const params = new URLSearchParams({
    text,
    language,
  });
  if (options.motherTongue) {
    params.set("motherTongue", options.motherTongue);
  }
  if (options.enabledRules?.length) {
    params.set("enabledRules", options.enabledRules.join(","));
  }
  if (options.disabledRules?.length) {
    params.set("disabledRules", options.disabledRules.join(","));
  }

  if (options.mode === "sidecar") {
    const port = await ensureSidecarRunning();
    const matches = await requestGrammar(`http://127.0.0.1:${port}/v2/check`, params);
    return { mode: "sidecar", matches, language };
  }

  const matches = await requestGrammar(REMOTE_ENDPOINT, params);
  return { mode: "remote", matches, language };
}

export function createGrammarDebouncer(delayMs: number, fn: (value: string) => void): (value: string) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (value: string) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(value);
    }, delayMs);
  };
}
