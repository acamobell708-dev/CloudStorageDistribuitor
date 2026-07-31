import { useState } from "react";
import { PdfPreview } from "./PdfPreview";
import { TextPreview } from "./TextPreview";
import { VideoThumbnailPreview } from "./VideoThumbnailPreview";

function PreviewError({ children }) {
  return (
    <p className="preview-error" role="alert">
      {children}
    </p>
  );
}

export function FilePreviewContent({
  capability,
  file,
  previewUrl
}) {
  const [mediaError, setMediaError] = useState();

  if (capability.kind === "image") {
    return mediaError ? (
      <PreviewError>
        This image format could not be decoded by the browser.
      </PreviewError>
    ) : (
      <div className="image-preview">
        <img
          alt={`Preview of ${file.name}`}
          onError={() => setMediaError(true)}
          src={previewUrl}
        />
      </div>
    );
  }

  if (capability.kind === "audio") {
    return (
      <div className="audio-preview">
        <div className="audio-preview-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <strong>{file.name}</strong>
        <audio
          controls
          onError={() => setMediaError(true)}
          preload="metadata"
          src={previewUrl}
        />
        {mediaError && (
          <PreviewError>
            This audio codec is not supported by the current browser.
          </PreviewError>
        )}
      </div>
    );
  }

  if (capability.kind === "video") {
    return (
      <VideoThumbnailPreview name={file.name} url={previewUrl} />
    );
  }

  if (capability.kind === "pdf") {
    return <PdfPreview name={file.name} url={previewUrl} />;
  }

  return <TextPreview url={previewUrl} />;
}

