import { useEffect, useRef, useState } from "react";
import { filePreviewLimits } from "../../../../src/shared/filePreviewPolicy.mjs";

let pdfLibraryPromise;

async function loadPdfLibrary() {
  pdfLibraryPromise ||= Promise.all([
    import("pdfjs-dist/build/pdf.mjs"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ]).then(([pdfLibrary, workerModule]) => {
    pdfLibrary.GlobalWorkerOptions.workerSrc = workerModule.default;
    return pdfLibrary;
  });

  return pdfLibraryPromise;
}

export function PdfPreview({ name, url }) {
  const canvasReference = useRef();
  const documentReference = useRef();
  const renderTaskReference = useRef();
  const [pageNumber, setPageNumber] = useState(1);
  const [state, setState] = useState({
    loadingDocument: true,
    loadingPage: false
  });

  useEffect(() => {
    let active = true;
    let loadingTask;

    setState({
      loadingDocument: true,
      loadingPage: false
    });

    loadPdfLibrary()
      .then((pdfLibrary) => {
        if (!active) {
          return undefined;
        }

        loadingTask = pdfLibrary.getDocument({
          url,
          withCredentials: true
        });
        return loadingTask.promise;
      })
      .then((pdfDocument) => {
        if (!active || !pdfDocument) {
          return;
        }

        documentReference.current = pdfDocument;
        const previewPages = Math.min(
          pdfDocument.numPages,
          filePreviewLimits.pdfPages
        );

        setPageNumber(1);
        setState({
          loadingDocument: false,
          loadingPage: true,
          previewPages,
          totalPages: pdfDocument.numPages
        });
      })
      .catch((error) => {
        if (active && error?.name !== "AbortException") {
          setState({
            error: "This PDF could not be opened securely in the browser.",
            loadingDocument: false,
            loadingPage: false
          });
        }
      });

    return () => {
      active = false;
      renderTaskReference.current?.cancel();
      loadingTask?.destroy();
      documentReference.current?.destroy();
      documentReference.current = undefined;
    };
  }, [url]);

  useEffect(() => {
    const pdfDocument = documentReference.current;

    if (!pdfDocument || !state.previewPages) {
      return undefined;
    }

    let active = true;

    renderTaskReference.current?.cancel();
    setState((current) => ({
      ...current,
      loadingPage: true
    }));

    pdfDocument
      .getPage(pageNumber)
      .then((page) => {
        if (!active) {
          return undefined;
        }

        const canvas = canvasReference.current;
        const context = canvas.getContext("2d", { alpha: false });
        const viewport = page.getViewport({ scale: 1.35 });
        const outputScale = Math.min(globalThis.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          transform:
            outputScale === 1
              ? undefined
              : [outputScale, 0, 0, outputScale, 0, 0],
          viewport
        });

        renderTaskReference.current = renderTask;
        return renderTask.promise;
      })
      .then(() => {
        if (active) {
          setState((current) => ({
            ...current,
            loadingPage: false
          }));
        }
      })
      .catch((error) => {
        if (active && error?.name !== "RenderingCancelledException") {
          setState((current) => ({
            ...current,
            error: "This PDF page could not be rendered.",
            loadingPage: false
          }));
        }
      });

    return () => {
      active = false;
      renderTaskReference.current?.cancel();
    };
  }, [pageNumber, state.previewPages]);

  if (state.loadingDocument) {
    return (
      <div className="preview-loading" role="status">
        <span className="loading-spinner" />
        Opening the bounded PDF preview…
      </div>
    );
  }

  if (state.error) {
    return <p className="preview-error">{state.error}</p>;
  }

  const previewWasLimited = state.totalPages > state.previewPages;

  return (
    <div className="pdf-preview">
      <div className="pdf-preview-toolbar">
        <button
          disabled={pageNumber <= 1 || state.loadingPage}
          onClick={() => setPageNumber((current) => current - 1)}
          type="button"
        >
          Previous
        </button>
        <span>
          Page {pageNumber} of {state.previewPages}
          {previewWasLimited
            ? ` preview pages (${state.totalPages} total)`
            : ""}
        </span>
        <button
          disabled={
            pageNumber >= state.previewPages || state.loadingPage
          }
          onClick={() => setPageNumber((current) => current + 1)}
          type="button"
        >
          Next
        </button>
      </div>
      {previewWasLimited && (
        <p className="preview-limit-note">
          Preview limited to the first {state.previewPages} pages. Download{" "}
          {name} to read the remainder.
        </p>
      )}
      <div className="pdf-canvas-wrap">
        {state.loadingPage && (
          <span className="pdf-page-loading">Rendering page…</span>
        )}
        <canvas
          aria-label={`Page ${pageNumber} of ${name}`}
          ref={canvasReference}
          role="img"
        />
      </div>
    </div>
  );
}

