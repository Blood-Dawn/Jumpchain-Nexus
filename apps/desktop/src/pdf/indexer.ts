/*
MIT License

Copyright (c) 2025 Bloodawn

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

import type { PdfIndexComplete, PdfIndexProgress } from "./types";
import type { PdfWorkerOutbound } from "./types";
import { indexFileText } from "../db/dao";
import { getPlatform } from "../services/platform";

export interface PdfIndexOptions {
  fileId: string;
  fileName: string;
  filePath: string;
  jumpId?: string | null;
  onProgress?: (progress: PdfIndexProgress) => void;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
    return view.buffer as ArrayBuffer;
  }
  return view.slice().buffer as ArrayBuffer;
}

export async function indexPdf(options: PdfIndexOptions): Promise<PdfIndexComplete> {
  const platform = await getPlatform();
  const data = await platform.fs.readBinaryFile(options.filePath);
  const worker = new Worker(new URL("./pdf-worker.ts", import.meta.url), { type: "module" });

  return new Promise((resolve, reject) => {
    const handleMessage = async (event: MessageEvent<PdfWorkerOutbound>) => {
      const payload = event.data;
      if (payload.type === "progress") {
        options.onProgress?.(payload);
        return;
      }

      if (payload.type === "error") {
        worker.removeEventListener("message", handleMessage);
        worker.terminate();
        reject(new Error(payload.message));
        return;
      }

      if (payload.type === "complete") {
        try {
          await indexFileText(options.fileId, payload.text);
        } catch (error) {
          worker.removeEventListener("message", handleMessage);
          worker.terminate();
          reject(error);
          return;
        }
        worker.removeEventListener("message", handleMessage);
        worker.terminate();
        resolve(payload);
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", (event) => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
      reject(event.error ?? new Error("Unexpected PDF worker error"));
    });

    const arrayBuffer = toArrayBuffer(data);
    worker.postMessage(
      {
        type: "index",
        fileId: options.fileId,
        fileName: options.fileName,
        jumpId: options.jumpId ?? null,
        arrayBuffer,
      },
      [arrayBuffer]
    );
  });
}
