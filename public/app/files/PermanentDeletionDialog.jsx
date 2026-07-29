import { useEffect, useRef } from "react";
import { Icon } from "../components/Icon";

export function PermanentDeletionDialog({
  error,
  file,
  onCancel,
  onConfirm,
  open,
  working
}) {
  const confirmButtonReference = useRef();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    confirmButtonReference.current?.focus();

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !working) {
        onCancel();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, open, working]);

  if (!open || !file) {
    return null;
  }

  const cancel = () => {
    onCancel();
  };

  return (
    <div
      className="permanent-delete-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) {
          cancel();
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby="permanent-delete-description"
        aria-labelledby="permanent-delete-title"
        aria-modal="true"
        className="permanent-delete-dialog"
        role="dialog"
      >
        <header>
          <span className="permanent-delete-warning-icon">
            <Icon name="warning" size={22} />
          </span>
          <div>
            <span className="eyebrow">Owner-only operation</span>
            <h2 id="permanent-delete-title">
              Permanently delete this item?
            </h2>
          </div>
          <button
            aria-label="Close permanent deletion dialog"
            className="dialog-close-button"
            disabled={working}
            onClick={cancel}
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div
          className="permanent-delete-content"
          id="permanent-delete-description"
        >
          <p>
            <strong>{file.name}</strong> will be removed from the current
            Azure repository and every reachable commit on its configured
            branch.
          </p>
          <ul>
            <li>The branch history will be rewritten and force-pushed.</li>
            <li>The operation cannot be restored through this application.</li>
            <li>
              Uploads pause while the server verifies the rewritten cloud
              history.
            </li>
            <li>
              Azure may retain unreachable internal objects until its own
              maintenance completes.
            </li>
          </ul>

          {error && (
            <div className="dialog-error" role="alert">
              <Icon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer>
          <button
            className="dialog-cancel-button"
            disabled={working}
            onClick={cancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="permanent-delete-confirm-button"
            disabled={working}
            onClick={onConfirm}
            ref={confirmButtonReference}
            type="button"
          >
            {working && <span className="file-action-spinner" />}
            I understand and want to proceed
          </button>
        </footer>
      </section>
    </div>
  );
}
