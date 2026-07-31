import { Icon } from "../components/Icon";
import { formatBytes } from "./storageInsights.mjs";

const actionLabels = {
  delete: "Deleted",
  download: "Downloaded",
  upload: "Added"
};

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getActionLabel(item) {
  return item.permanent ? "Permanently deleted" : actionLabels[item.action];
}

export function ActivityHistory({
  error,
  history,
  loading,
  onPageChange,
  refreshing
}) {
  return (
    <article className="activity-card-panel activity-history-card">
      <header className="activity-card-heading">
        <div>
          <span className="eyebrow">Shared audit trail</span>
          <h2>Upload, download and deletion history</h2>
          <p>The latest successful storage actions from all members.</p>
        </div>
        <span className="activity-history-count">
          {history.totalItems} event{history.totalItems === 1 ? "" : "s"}
        </span>
      </header>

      {error && <p className="activity-history-error">{error}</p>}

      {loading ? (
        <div className="activity-panel-loading" role="status">
          <span className="loading-spinner" />
          Loading shared history…
        </div>
      ) : history.items.length === 0 ? (
        <div className="activity-empty">
          <strong>No activity recorded yet</strong>
          <span>Uploads, downloads and deletions will be listed here.</span>
        </div>
      ) : (
        <ul className="activity-history-list">
          {history.items.map((item) => (
            <li key={item.id}>
              <span className={`activity-action-icon is-${item.action}`}>
                <Icon
                  name={
                    item.action === "upload"
                      ? "upload"
                      : item.action === "download"
                        ? "download"
                        : "trash"
                  }
                  size={17}
                />
              </span>
              <span className="activity-event-copy">
                <strong>{getActionLabel(item)}</strong>
                <small>
                  {item.itemCount > 1
                    ? `${item.itemCount} items`
                    : item.file.type === "folder"
                      ? "Folder"
                      : Number.isFinite(item.file.size)
                        ? formatBytes(item.file.size)
                        : "File"}
                </small>
              </span>
              <span className="activity-file-copy">
                <strong title={item.file.name}>{item.file.name}</strong>
                <small title={item.file.path}>{item.file.path || "Root"}</small>
              </span>
              <span className="activity-provider-copy">
                <strong>{item.provider.displayName}</strong>
                <small>{item.user.displayName}</small>
              </span>
              <time dateTime={item.occurredAt}>
                {formatTimestamp(item.occurredAt)}
              </time>
            </li>
          ))}
        </ul>
      )}

      <footer className="activity-pagination">
        <span>
          Page {history.page} of {history.totalPages}
        </span>
        <div>
          <button
            disabled={!history.hasPrevious || loading || refreshing}
            onClick={() => onPageChange(history.page - 1)}
            type="button"
          >
            Previous
          </button>
          <button
            disabled={!history.hasNext || loading || refreshing}
            onClick={() => onPageChange(history.page + 1)}
            type="button"
          >
            Next page
          </button>
        </div>
      </footer>
    </article>
  );
}
