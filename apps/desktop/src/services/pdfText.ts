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

import type { PdfIndexComplete, PdfIndexProgress, PdfWorkerOutbound } from "../pdf/types";
import { getPlatform } from "./platform";

export interface ReadPdfTextOptions {
  onProgress?: (progress: PdfIndexProgress) => void;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
    return view.buffer as ArrayBuffer;
  }
  return view.slice().buffer as ArrayBuffer;
}

export async function readPdfText(
  filePath: string,
  options: ReadPdfTextOptions = {}
): Promise<PdfIndexComplete> {
  const platform = await getPlatform();
  const data = await platform.fs.readBinaryFile(filePath);
  const worker = new Worker(new URL("../pdf/pdf-worker.ts", import.meta.url), { type: "module" });
  const fileId = randomId();
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
    };

    const handleError = (event: ErrorEvent) => {
      cleanup();
      reject(event.error ?? new Error("Unexpected PDF worker error"));
    };

    const handleMessage = (event: MessageEvent<PdfWorkerOutbound>) => {
      const payload = event.data;

      if (payload.type === "progress") {
        options.onProgress?.(payload);
        return;
      }

      if (payload.type === "error") {
        cleanup();
        reject(new Error(payload.message));
        return;
      }

      cleanup();
      resolve(payload);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    const arrayBuffer = toArrayBuffer(data);
    worker.postMessage(
      {
        type: "index",
        fileId,
        fileName,
        jumpId: null,
        arrayBuffer,
      },
      [arrayBuffer]
    );
  });
}
