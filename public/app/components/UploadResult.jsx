import { formatBytes } from "./FileDropzone";
import { Icon } from "./Icon";

export function UploadResult({ onReset, result }) {
  const file = result.file;
  const files = result.files || [file];
  const totalSize = files.reduce(
    (total, currentFile) => total + (Number(currentFile.size) || 0),
    0
  );
  const storageReference =
    file.provider === "azure"
      ? file.commit
        ? `Commit ${file.commit.slice(0, 7)}`
        : file.path
      : `Box ID ${file.id}`;

  return (
    <div className="result-card" role="status">
      <div className="result-icon">
        <Icon name="check" size={28} strokeWidth={2.2} />
      </div>
      <div className="result-copy">
        <span className="eyebrow">
          {result.duplicateCount === files.length
            ? "Already protected"
            : "Transfer complete"}
        </span>
        <h3>
          {result.mode === "folder"
            ? "Folder upload complete"
            : files.length > 1
              ? `${files.length} files uploaded`
              : file.originalName || file.filename}
        </h3>
        <p>{result.message}</p>
        <div className="result-meta">
          <span>{storageReference}</span>
          <i aria-hidden="true">•</i>
          <span>{formatBytes(totalSize)}</span>
          <i aria-hidden="true">•</i>
          <span>
            {files.length} {files.length === 1 ? "item" : "items"} checked
          </span>
        </div>
      </div>
      <button className="secondary-button" onClick={onReset} type="button">
        Start another upload
      </button>
    </div>
  );
}
