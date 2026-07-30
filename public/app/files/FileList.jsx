import { formatBytes } from "../components/FileDropzone";
import { Icon } from "../components/Icon";

function formatDate(value) {
  if (!value) {
    return "Not supplied";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not supplied";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatVersion(value) {
  if (!value) {
    return "Current";
  }

  return value.length > 12 ? value.slice(0, 12) : value;
}

export function createFileKey(file) {
  return JSON.stringify([file.provider, file.id, file.path]);
}

function handleRowKeyDown(event, file, onOpenFolder, onSelect) {
  if (
    event.target !== event.currentTarget ||
    !["Enter", " "].includes(event.key)
  ) {
    return;
  }

  event.preventDefault();
  if (file.type === "folder") {
    onOpenFolder(file);
  } else {
    onSelect(file);
  }
}

export function FileList({
  canDelete,
  files,
  onDelete,
  onDownload,
  onOpenFolder,
  onSelect,
  providerName,
  selectedFileKey,
  workingFileKey
}) {
  if (files.length === 0) {
    return (
      <div className="files-empty">
        <span className="files-empty-icon">
          <Icon name="folder" size={25} />
        </span>
        <h2>This folder is empty</h2>
        <p>
          The current {providerName} folder does not contain any files or
          subfolders.
        </p>
      </div>
    );
  }

  return (
    <div className="file-table-wrap">
      <table className="file-table" aria-label={`${providerName} files`}>
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Location</th>
            <th scope="col">Size</th>
            <th scope="col">Updated</th>
            <th scope="col">Version</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const fileKey = createFileKey(file);
            const selected = selectedFileKey === fileKey;
            const working = workingFileKey === fileKey;
            const isFolder = file.type === "folder";

            return (
              <tr
                aria-selected={selected}
                className={
                  `file-row${selected ? " is-selected" : ""}` +
                  `${isFolder ? " is-folder" : ""}`
                }
                key={fileKey}
                onClick={() =>
                  isFolder ? onOpenFolder(file) : onSelect(file)
                }
                onKeyDown={(event) =>
                  handleRowKeyDown(
                    event,
                    file,
                    onOpenFolder,
                    onSelect
                  )
                }
                tabIndex="0"
                title={
                  isFolder
                    ? `Open ${file.name}`
                    : selected
                    ? `Manage ${file.name}`
                    : `Select ${file.name}`
                }
              >
                <td data-label="File">
                  <span className="file-type-icon">
                    <Icon
                      name={isFolder ? "folder" : "document"}
                      size={18}
                    />
                  </span>
                  <span className="listed-file-name">
                    {file.name}
                  </span>
                  {isFolder && (
                    <span className="folder-open-hint">
                      Open
                      <Icon name="chevron" size={13} />
                    </span>
                  )}
                  {selected && !isFolder && (
                    <span className="file-row-actions">
                      <button
                        aria-label={`Download ${file.name}`}
                        className="file-action-button file-download-button"
                        disabled={working}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDownload(file);
                        }}
                        type="button"
                      >
                        <Icon name="download" size={16} />
                        Download File
                      </button>
                      {canDelete && (
                        <button
                          aria-label={`Delete ${file.name}`}
                          className="file-action-button file-delete-button"
                          disabled={working}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(file);
                          }}
                          type="button"
                        >
                          <Icon name="trash" size={15} />
                          Delete item
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td data-label="Location" title={file.path}>
                  <code>{file.path}</code>
                </td>
                <td data-label="Size">
                  {isFolder
                    ? "—"
                    : Number.isFinite(file.size)
                    ? formatBytes(file.size)
                    : "Not supplied"}
                </td>
                <td data-label="Updated">{formatDate(file.modifiedAt)}</td>
                <td data-label="Version">
                  {isFolder ? (
                    "—"
                  ) : (
                    <code title={file.version}>
                      {formatVersion(file.version)}
                    </code>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
