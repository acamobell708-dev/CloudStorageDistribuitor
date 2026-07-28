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

function handleRowKeyDown(event, file, onSelect) {
  if (
    event.target !== event.currentTarget ||
    !["Enter", " "].includes(event.key)
  ) {
    return;
  }

  event.preventDefault();
  onSelect(file);
}

export function FileList({
  files,
  onDownload,
  onSelect,
  providerName,
  selectedFileKey
}) {
  if (files.length === 0) {
    return (
      <div className="files-empty">
        <span className="files-empty-icon">
          <Icon name="folder" size={25} />
        </span>
        <h2>No files found</h2>
        <p>
          The configured {providerName} location does not currently contain
          any files.
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

            return (
              <tr
                aria-selected={selected}
                className={`file-row${selected ? " is-selected" : ""}`}
                key={fileKey}
                onClick={() => onSelect(file)}
                onKeyDown={(event) =>
                  handleRowKeyDown(event, file, onSelect)
                }
                tabIndex="0"
                title={
                  selected
                    ? `Download ${file.name}`
                    : `Select ${file.name}`
                }
              >
                <td data-label="File">
                  <span className="file-type-icon">
                    <Icon name="document" size={18} />
                  </span>
                  <span className="listed-file-name">
                    {file.name}
                  </span>
                  {selected && (
                    <button
                      aria-label={`Download ${file.name}`}
                      className="file-download-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDownload(file);
                      }}
                      type="button"
                    >
                      <Icon name="download" size={16} />
                      Download File
                    </button>
                  )}
                </td>
                <td data-label="Location" title={file.path}>
                  <code>{file.path}</code>
                </td>
                <td data-label="Size">
                  {Number.isFinite(file.size)
                    ? formatBytes(file.size)
                    : "Not supplied"}
                </td>
                <td data-label="Updated">{formatDate(file.modifiedAt)}</td>
                <td data-label="Version">
                  <code title={file.version}>
                    {formatVersion(file.version)}
                  </code>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
