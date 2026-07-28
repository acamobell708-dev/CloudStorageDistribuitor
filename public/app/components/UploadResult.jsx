import { formatBytes } from "./FileDropzone";
import { Icon } from "./Icon";

export function UploadResult({ onReset, result }) {
  const file = result.file;
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
          {file.duplicate ? "Already protected" : "Transfer complete"}
        </span>
        <h3>{file.originalName || file.filename}</h3>
        <p>{result.message}</p>
        <div className="result-meta">
          <span>{storageReference}</span>
          <i aria-hidden="true">•</i>
          <span>{formatBytes(file.size)}</span>
          <i aria-hidden="true">•</i>
          <span>SHA-256 checked</span>
        </div>
      </div>
      <button className="secondary-button" onClick={onReset} type="button">
        Send another
      </button>
    </div>
  );
}
