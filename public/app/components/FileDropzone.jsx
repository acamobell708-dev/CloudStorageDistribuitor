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

function getPickerSelections(fileList, mode) {
  return Array.from(fileList || []).map((file) => ({
    file,
    relativePath:
      mode === "folder"
        ? file.webkitRelativePath || file.name
        : file.name
  }));
}

function readFileEntry(entry, relativePath) {
  return new Promise((resolve, reject) => {
    entry.file(
      (file) =>
        resolve({
          file,
          relativePath
        }),
      reject
    );
  });
}

async function readDirectoryEntries(directoryEntry) {
  const reader = directoryEntry.createReader();
  const entries = [];

  while (true) {
    const batch = await new Promise((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );

    if (batch.length === 0) {
      return entries;
    }

    entries.push(...batch);
  }
}

async function traverseEntry(entry, parentPath = "") {
  const relativePath = parentPath
    ? `${parentPath}/${entry.name}`
    : entry.name;

  if (entry.isFile) {
    return [await readFileEntry(entry, relativePath)];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const children = await readDirectoryEntries(entry);
  const nestedFiles = await Promise.all(
    children.map((child) => traverseEntry(child, relativePath))
  );

  return nestedFiles.flat();
}

async function getDroppedSelections(dataTransfer, mode) {
  if (mode !== "folder") {
    return getPickerSelections(dataTransfer.files, mode);
  }

  const entries = Array.from(dataTransfer.items || [])
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);

  if (entries.length === 0) {
    return getPickerSelections(dataTransfer.files, mode);
  }

  return (
    await Promise.all(entries.map((entry) => traverseEntry(entry)))
  ).flat();
}

const modeCopy = {
  folder: {
    browse: "choose a folder",
    heading: "Drop a folder here"
  },
  multiple: {
    browse: "browse for files",
    heading: "Drop files here"
  },
  single: {
    browse: "browse your device",
    heading: "Drop a file here"
  }
};

export function FileDropzone({
  acceptedDescription = "Files",
  acceptedFileTypes = ["*/*"],
  disabled,
  files = [],
  maximumUploadSizeBytes,
  mode = "single",
  onClear,
  onSelect
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState();
  const firstFile = files[0]?.file;
  const totalSize = files.reduce(
    (total, selection) => total + selection.file.size,
    0
  );

  useEffect(() => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    if (mode === "folder") {
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
    } else {
      input.removeAttribute("webkitdirectory");
      input.removeAttribute("directory");
    }
  }, [mode]);

  useEffect(() => {
    if (
      files.length !== 1 ||
      !firstFile?.type?.startsWith("image/")
    ) {
      setPreviewUrl(undefined);
      return undefined;
    }

    const url = URL.createObjectURL(firstFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [files, firstFile]);

  function chooseFiles() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseFiles();
    }
  }

  async function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    if (disabled) {
      return;
    }

    const selections = await getDroppedSelections(
      event.dataTransfer,
      mode
    );

    if (selections.length > 0) {
      onSelect(mode === "single" ? selections.slice(0, 1) : selections);
    }
  }

  if (files.length > 0) {
    const label =
      mode === "folder"
        ? files[0].relativePath.split("/")[0]
        : files.length === 1
          ? firstFile.name
          : `${files.length} files selected`;

    return (
      <div className="selected-file" aria-live="polite">
        <div className="file-preview">
          {previewUrl ? (
            <img src={previewUrl} alt="" />
          ) : (
            <>
              <Icon
                name={mode === "folder" ? "folder" : "document"}
                size={24}
              />
              <span>
                {mode === "folder"
                  ? "FOLDER"
                  : files.length > 1
                    ? `${files.length} FILES`
                    : getFileExtension(firstFile.name)}
              </span>
            </>
          )}
        </div>
        <div className="file-copy">
          <strong title={label}>{label}</strong>
          <span>
            {formatBytes(totalSize)}
            <i aria-hidden="true">•</i>
            {files.length} {files.length === 1 ? "file" : "files"}
          </span>
          {files.length > 1 && (
            <small className="selected-file-list">
              {files
                .slice(0, 3)
                .map((selection) => selection.relativePath)
                .join(" · ")}
              {files.length > 3
                ? ` · +${files.length - 3} more`
                : ""}
            </small>
          )}
        </div>
        <button
          aria-label={`Clear ${label}`}
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
      onClick={chooseFiles}
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
        aria-label={`Choose ${
          mode === "folder"
            ? "a folder"
            : mode === "multiple"
              ? "files"
              : "a file"
        }`}
        disabled={disabled}
        multiple={mode !== "single"}
        onChange={(event) => {
          const selections = getPickerSelections(
            event.target.files,
            mode
          );
          if (selections.length > 0) onSelect(selections);
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
      <h3>{modeCopy[mode].heading}</h3>
      <p>
        or <span>{modeCopy[mode].browse}</span>
      </p>
      <small>
        {acceptedDescription} · up to{" "}
        {formatBytes(maximumUploadSizeBytes)} per file
      </small>
    </div>
  );
}

export { formatBytes };
