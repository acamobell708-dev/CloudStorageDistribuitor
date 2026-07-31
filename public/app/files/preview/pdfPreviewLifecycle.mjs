export function disposePdfPreview({ loadingTask, renderTask } = {}) {
  try {
    renderTask?.cancel();
  } catch {
    // A completed or already-cancelled render does not need further cleanup.
  }

  if (typeof loadingTask?.destroy !== "function") {
    return Promise.resolve();
  }

  return Promise.resolve()
    .then(() => loadingTask.destroy())
    .catch(() => undefined);
}
