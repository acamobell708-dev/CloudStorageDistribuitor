import { useEffect, useState } from "react";
import { filePreviewLimits } from "../../../../src/shared/filePreviewPolicy.mjs";

function getResponseError(response, body) {
  try {
    return JSON.parse(body)?.error?.message;
  } catch {
    return undefined;
  }
}

export function TextPreview({ url }) {
  const [state, setState] = useState({
    loading: true
  });

  useEffect(() => {
    const controller = new AbortController();

    setState({ loading: true });
    fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "text/plain",
        Range: `bytes=0-${filePreviewLimits.textBytes}`
      },
      signal: controller.signal
    })
      .then(async (response) => {
        const content = await response.text();

        if (!response.ok) {
          throw new Error(
            getResponseError(response, content) ||
              "The text preview could not be loaded"
          );
        }

        setState({
          content,
          loading: false,
          truncated:
            response.headers.get("X-Preview-Truncated") === "true"
        });
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState({
            error: error.message,
            loading: false
          });
        }
      });

    return () => controller.abort();
  }, [url]);

  if (state.loading) {
    return (
      <div className="preview-loading" role="status">
        <span className="loading-spinner" />
        Loading secure text preview…
      </div>
    );
  }

  if (state.error) {
    return <p className="preview-error">{state.error}</p>;
  }

  return (
    <div className="text-preview">
      {state.truncated && (
        <p className="preview-limit-note">
          Showing the first 256 KiB. Download the file to read the remainder.
        </p>
      )}
      <pre>
        <code>{state.content}</code>
      </pre>
    </div>
  );
}

