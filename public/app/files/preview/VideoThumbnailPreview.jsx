import { useCallback, useRef, useState } from "react";

const maximumFrameWidth = 1280;

export function VideoThumbnailPreview({ name, url }) {
  const canvasReference = useRef();
  const capturedReference = useRef(false);
  const targetTimeReference = useRef(0);
  const videoReference = useRef();
  const [state, setState] = useState({
    loading: true
  });

  const captureFrame = useCallback(() => {
    const video = videoReference.current;
    const canvas = canvasReference.current;

    if (
      capturedReference.current ||
      !video ||
      !canvas ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return;
    }

    try {
      const scale = Math.min(1, maximumFrameWidth / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas
        .getContext("2d", { alpha: false })
        .drawImage(video, 0, 0, canvas.width, canvas.height);
      capturedReference.current = true;
      video.pause();
      setState({ loading: false });
    } catch {
      setState({
        error: "This video frame could not be decoded by the browser.",
        loading: false
      });
    }
  }, []);

  const chooseFrame = (event) => {
    const video = event.currentTarget;
    const duration = Number(video.duration);
    const targetTime =
      Number.isFinite(duration) && duration > 0.2
        ? Math.min(5, Math.max(0.1, duration * 0.1))
        : 0;

    targetTimeReference.current = targetTime;

    if (targetTime > 0) {
      video.currentTime = targetTime;
    } else {
      captureFrame();
    }
  };

  return (
    <div className="video-thumbnail-preview">
      <video
        aria-hidden="true"
        muted
        onError={() =>
          setState({
            error:
              "This video uses a format or codec that the browser cannot preview.",
            loading: false
          })
        }
        onLoadedData={() => {
          if (targetTimeReference.current === 0) {
            captureFrame();
          }
        }}
        onLoadedMetadata={chooseFrame}
        onSeeked={captureFrame}
        playsInline
        preload="metadata"
        ref={videoReference}
        src={url}
      />
      {state.loading && (
        <div className="preview-loading" role="status">
          <span className="loading-spinner" />
          Creating one still frame…
        </div>
      )}
      {state.error && <p className="preview-error">{state.error}</p>}
      <canvas
        aria-label={`Still-frame preview of ${name}`}
        className={state.loading || state.error ? "is-hidden" : ""}
        ref={canvasReference}
        role="img"
      />
      {!state.loading && !state.error && (
        <p className="video-thumbnail-caption">
          Still image only — the video is not played in the preview.
        </p>
      )}
    </div>
  );
}
