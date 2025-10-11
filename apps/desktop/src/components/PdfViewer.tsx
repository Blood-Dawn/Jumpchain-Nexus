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

import { readFile } from "@tauri-apps/plugin-fs";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfWorkerConstructor = new () => Worker;

let pdfjsModulePromise:
  | Promise<{
      getDocument: typeof import("pdfjs-dist")["getDocument"];
    }>
  | null = null;

async function loadPdfjs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.mjs?worker&module"),
    ]).then(([pdfjs, workerModule]) => {
      const WorkerConstructor = (workerModule.default ?? workerModule) as PdfWorkerConstructor;
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        pdfjs.GlobalWorkerOptions.workerPort = new WorkerConstructor();
      }
      return { getDocument: pdfjs.getDocument };
    });
  }
  return pdfjsModulePromise;
}

export interface PdfViewerProps {
  filePath: string;
  initialPage?: number;
  initialSearch?: string;
}

interface RenderState {
  text: string;
  viewportWidth: number;
  viewportHeight: number;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, term: string): React.ReactNode {
  if (!term.trim()) {
    return text;
  }
  const matcher = new RegExp(`(${escapeRegExp(term)})`, "gi");
  const segments = text.split(matcher);
  return segments.map((segment, index) =>
    matcher.test(segment) ? (
      <mark key={`${segment}-${index}`} className="pdf-viewer__highlight">
        {segment}
      </mark>
    ) : (
      <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>
    )
  );
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  filePath,
  initialPage = 1,
  initialSearch = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderState, setRenderState] = useState<RenderState | null>(null);
  const [scale, setScale] = useState(1.2);

  useEffect(() => {
    let cancelled = false;
    let activeDoc: PDFDocumentProxy | null = null;

    async function loadPdf(): Promise<void> {
      setLoading(true);
      setError(null);
      setRenderState(null);
      try {
        const data = await readFile(filePath);
        const { getDocument } = await loadPdfjs();
        const task = getDocument({ data });
        const doc = await task.promise;
        activeDoc = doc;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setCurrentPage(Math.min(initialPage, doc.numPages) || 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf().catch((err) => setError(String(err)));

    return () => {
      cancelled = true;
      void activeDoc?.destroy();
    };
  }, [filePath, initialPage]);

  useEffect(() => {
    if (!pdfDoc) return;
    const doc = pdfDoc;
    let cancelled = false;

    async function renderPage(): Promise<void> {
      try {
        const page = await doc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const pieces = textContent.items.map((item) => (
          (item as { str?: string }).str ?? ""
        ));
        setRenderState({
          text: pieces.join(" ").trim(),
          viewportHeight: viewport.height,
          viewportWidth: viewport.width,
        });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
        }
      }
    }

    renderPage().catch((err) => setError(String(err)));

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch]);

  const textContent = renderState?.text ?? "";
  const isTextMissing = !textContent && !loading && !error;

  const highlighted = useMemo(
    () => highlight(textContent, searchTerm),
    [textContent, searchTerm]
  );

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer__toolbar">
        <div className="pdf-viewer__nav">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            disabled={currentPage <= 1 || loading}
          >
            Prev
          </button>
          <span>
            Page {Math.min(currentPage, pageCount)} / {pageCount || "?"}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) =>
                pageCount ? Math.min(page + 1, pageCount) : page + 1
              )
            }
            disabled={pageCount > 0 ? currentPage >= pageCount : loading}
          >
            Next
          </button>
        </div>
        <div className="pdf-viewer__zoom">
          <button
            type="button"
            onClick={() => setScale((value) => Math.max(0.6, value - 0.2))}
            disabled={loading}
          >
            -
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setScale((value) => Math.min(3, value + 0.2))}
            disabled={loading}
          >
            +
          </button>
        </div>
        <label className="pdf-viewer__search">
          <span>Find</span>
          <input
            type="search"
            value={searchTerm}
            placeholder="Search text"
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </div>
      {error ? (
        <div className="pdf-viewer__error">{error}</div>
      ) : (
        <div className="pdf-viewer__content">
          <canvas ref={canvasRef} className="pdf-viewer__canvas" />
          <div className="pdf-viewer__text">
            {loading && <p>Loading PDF…</p>}
            {isTextMissing && (
              <p className="pdf-viewer__empty">
                This page did not expose selectable text. Some PDFs flatten their
                text layer. Extraction results may be incomplete.
              </p>
            )}
            {!loading && !isTextMissing && (
              <p>{highlighted}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfViewer;
