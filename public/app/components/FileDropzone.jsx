import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

function formatBytes(size) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename) {
  const extension = filename.split(".").pop();
  return extension && extension !== filename
    ? extension.slice(0, 5).toUpperCase()
    : "FILE";
}

export function FileDropzone({
  acceptedDescription = "Files",
  acceptedFileTypes = ["*/*"],
  disabled,
  file,
  maximumUploadSizeBytes,
  onClear,
  onSelect
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState();

  useEffect(() => {
    if (!file?.type?.startsWith("image/")) {
      setPreviewUrl(undefined);
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseFile();
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    if (!disabled && event.dataTransfer.files?.[0]) {
      onSelect(event.dataTransfer.files[0]);
    }
  }

  if (file) {
    return (
      <div className="selected-file" aria-live="polite">
        <div className="file-preview">
          {previewUrl ? (
            <img src={previewUrl} alt="" />
          ) : (
            <>
              <Icon name="document" size={24} />
              <span>{getFileExtension(file.name)}</span>
            </>
          )}
        </div>
        <div className="file-copy">
          <strong title={file.name}>{file.name}</strong>
          <span>
            {formatBytes(file.size)}
            <i aria-hidden="true">•</i>
            {file.type || "Unknown file type"}
          </span>
        </div>
        <button
          aria-label={`Remove ${file.name}`}
          className="icon-button"
          disabled={disabled}
          onClick={onClear}
          type="button"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      aria-disabled={disabled}
      className={`dropzone ${dragging ? "is-dragging" : ""}`}
      onClick={chooseFile}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <input
        aria-label="Choose a file"
        disabled={disabled}
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          if (selectedFile) onSelect(selectedFile);
          event.target.value = "";
        }}
        ref={inputRef}
        accept={
          acceptedFileTypes.includes("*/*")
            ? undefined
            : acceptedFileTypes.join(",")
        }
        type="file"
      />
      <div className="upload-orbit">
        <span className="orbit-dot orbit-dot-one" />
        <span className="orbit-dot orbit-dot-two" />
        <div className="upload-icon">
          <Icon name="upload" size={27} />
        </div>
      </div>
      <h3>Drop a file here</h3>
      <p>
        or <span>browse your device</span>
      </p>
      <small>
        {acceptedDescription} · up to{" "}
        {formatBytes(maximumUploadSizeBytes)}
      </small>
    </div>
  );
}

export { formatBytes };
