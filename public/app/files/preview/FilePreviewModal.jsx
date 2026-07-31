import { useEffect, useRef } from "react";
import { formatBytes } from "../../components/FileDropzone";
import { Icon } from "../../components/Icon";
import { getFilePreviewCapability } from "../../../../src/shared/filePreviewPolicy.mjs";
import { FilePreviewContent } from "./FilePreviewContent";

const previewLabels = {
  audio: "Audio player",
  image: "Image preview",
  pdf: "Bounded PDF",
  source: "Limited source preview",
  text: "Limited text preview",
  video: "Video still frame"
};

export function FilePreviewModal({
  downloadUrl,
  file,
  onClose,
  open,
  previewUrl
}) {
  const closeButtonReference = useRef();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonReference.current?.focus();

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  if (!open || !file) {
    return null;
  }

  const capability = getFilePreviewCapability(file);

  if (!capability.available) {
    return null;
  }

  return (
    <div
      className="file-preview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby="file-preview-title"
        aria-modal="true"
        className="file-preview-dialog"
        role="dialog"
      >
        <header>
          <span className="file-preview-heading-icon">
            <Icon name="eye" size={21} />
          </span>
          <div>
            <span className="eyebrow">
              {previewLabels[capability.kind]}
            </span>
            <h2 id="file-preview-title">{file.name}</h2>
            <p>
              {Number.isFinite(file.size)
                ? `${formatBytes(file.size)} · `
                : ""}
              rendered locally in this browser
            </p>
          </div>
          <button
            aria-label="Close file preview"
            className="dialog-close-button"
            onClick={onClose}
            ref={closeButtonReference}
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="file-preview-content">
          <FilePreviewContent
            capability={capability}
            file={file}
            previewUrl={previewUrl}
          />
        </div>

        <footer>
          <p>
            Preview data is not shared with a third-party viewer.
          </p>
          <div>
            <a
              className="preview-download-button"
              download
              href={downloadUrl}
            >
              <Icon name="download" size={15} />
              Download file
            </a>
            <button
              className="dialog-cancel-button"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
