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

export function FileList({ files, providerName }) {
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
      <table className="file-table">
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
          {files.map((file) => (
            <tr key={`${file.provider}-${file.id || file.path}`}>
              <td data-label="File">
                <span className="file-type-icon">
                  <Icon name="document" size={18} />
                </span>
                <span className="listed-file-name">
                  {file.webUrl ? (
                    <a
                      href={file.webUrl}
                      rel="noreferrer"
                      target="_blank"
                      title={`Open ${file.name} in ${providerName}`}
                    >
                      {file.name}
                    </a>
                  ) : (
                    file.name
                  )}
                </span>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
