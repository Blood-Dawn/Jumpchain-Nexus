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

/// <reference lib="webworker" />

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PdfIndexRequest, PdfWorkerOutbound } from "./types";

GlobalWorkerOptions.workerPort = null;

function postOutboundMessage(message: PdfWorkerOutbound): void {
  postMessage(message);
}

async function extractText(request: PdfIndexRequest): Promise<void> {
  const loadingTask = getDocument({ data: request.arrayBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const parts: string[] = [];
  let emptyPages = 0;

  for (let index = 1; index <= totalPages; index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    const strings: string[] = [];
    for (const item of content.items) {
      const candidate = (item as { str?: string }).str ?? "";
      strings.push(candidate);
    }
    const pageText = strings.join(" ").trim();
    if (!pageText) {
      emptyPages += 1;
    }
    parts.push(pageText);
    postOutboundMessage({
      type: "progress",
      fileId: request.fileId,
      currentPage: index,
      totalPages,
      percent: Math.round((index / totalPages) * 100),
    });
  }

  postOutboundMessage({
    type: "complete",
    fileId: request.fileId,
    text: parts.join("\n\n"),
    totalPages,
    emptyPages,
  });
}

self.addEventListener("message", (event: MessageEvent<PdfIndexRequest>) => {
  const payload = event.data;
  if (!payload || payload.type !== "index") {
    return;
  }

  extractText(payload).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    postOutboundMessage({
      type: "error",
      fileId: payload.fileId,
      message,
    });
  });
});
