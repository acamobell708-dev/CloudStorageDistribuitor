import { useEffect, useMemo, useState } from "react";
import { StorageApiClient } from "./api/StorageApiClient";
import { FileDropzone } from "./components/FileDropzone";
import { Icon } from "./components/Icon";
import { ProviderPanel } from "./components/ProviderPanel";
import { UploadResult } from "./components/UploadResult";

const defaultMaximumUploadSizeBytes = 50 * 1024 * 1024;

export default function App() {
  const apiClient = useMemo(() => new StorageApiClient(), []);
  const [file, setFile] = useState();
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providerError, setProviderError] = useState();
  const [upload, setUpload] = useState({
    error: undefined,
    progress: 0,
    result: undefined,
    status: "idle"
  });
  const boxProvider = providers.find((provider) => provider.key === "box");
  const maximumUploadSizeBytes =
    boxProvider?.maximumUploadSizeBytes || defaultMaximumUploadSizeBytes;
  const uploading = upload.status === "uploading";
  const canUpload = Boolean(
    file && boxProvider?.configured && !uploading
  );

  useEffect(() => {
    let active = true;

    apiClient
      .listProviders()
      .then((availableProviders) => {
        if (active) setProviders(availableProviders);
      })
      .catch((error) => {
        if (active) setProviderError(error.message);
      })
      .finally(() => {
        if (active) setProvidersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiClient]);

  function selectFile(selectedFile) {
    if (selectedFile.size === 0) {
      setUpload((current) => ({
        ...current,
        error: "The selected file is empty",
        status: "error"
      }));
      return;
    }

    if (selectedFile.size > maximumUploadSizeBytes) {
      const limitMb = maximumUploadSizeBytes / (1024 * 1024);
      setUpload((current) => ({
        ...current,
        error: `Choose a file that is ${limitMb} MB or smaller`,
        status: "error"
      }));
      return;
    }

    setFile(selectedFile);
    setUpload({
      error: undefined,
      progress: 0,
      result: undefined,
      status: "idle"
    });
  }

  function reset() {
    setFile(undefined);
    setUpload({
      error: undefined,
      progress: 0,
      result: undefined,
      status: "idle"
    });
  }

  async function sendFile() {
    if (!canUpload) {
      return;
    }

    setUpload({
      error: undefined,
      progress: 2,
      result: undefined,
      status: "uploading"
    });

    try {
      const result = await apiClient.uploadFile({
        file,
        onProgress: (progress) =>
          setUpload((current) => ({ ...current, progress })),
        provider: "box"
      });

      setUpload({
        error: undefined,
        progress: 100,
        result,
        status: "success"
      });
    } catch (error) {
      setUpload({
        error: error.message,
        progress: 0,
        result: undefined,
        status: "error"
      });
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cloud Storage home">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>
            CLOUD<span>PORT</span>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a className="is-active" href="#send">
            Send
          </a>
          <a href="#connections">Connections</a>
          <a href="#activity">Activity</a>
        </nav>
        <button className="profile-button" type="button" aria-label="Account">
          AD
        </button>
      </header>

      <div className="workspace">
        <aside className="side-rail" aria-label="Workspace sections">
          <div className="rail-group">
            <span className="rail-label">Workspace</span>
            <a className="rail-link is-active" href="#send">
              <Icon name="grid" size={18} />
              <span>Dashboard</span>
            </a>
            <a className="rail-link" href="#files">
              <Icon name="folder" size={19} />
              <span>My files</span>
            </a>
            <a className="rail-link" href="#search">
              <Icon name="search" size={18} />
              <span>Search</span>
            </a>
            <a className="rail-link" href="#activity">
              <Icon name="clock" size={18} />
              <span>Activity</span>
            </a>
          </div>
          <div className="rail-group">
            <span className="rail-label">Storage</span>
            <a className="rail-link" href="#connections">
              <Icon name="archive" size={18} />
              <span>Connections</span>
              <span className="rail-count">1</span>
            </a>
          </div>
          <div className="rail-footer">
            <div className="mini-shield">
              <Icon name="lock" size={17} />
            </div>
            <div>
              <strong>Server secured</strong>
              <span>Secrets stay in src</span>
            </div>
          </div>
        </aside>

        <main id="send">
          <section className="hero">
            <div>
              <span className="section-kicker">
                <span />
                Secure cloud transfer
              </span>
              <h1>
                One file. <em>Right where it belongs.</em>
              </h1>
              <p>
                Send documents, images, spreadsheets, archives and more to your
                connected Box workspace—without exposing a single credential.
              </p>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-icon">
                <Icon name="shield" size={22} />
              </div>
              <div>
                <strong>SHA-256</strong>
                <span>Duplicate protection</span>
              </div>
            </div>
          </section>

          <section className="transfer-grid">
            <div className="upload-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">New transfer</span>
                  <h2>Choose your file</h2>
                </div>
                <span className="step-label">Step 1 of 1</span>
              </div>

              {upload.result ? (
                <UploadResult result={upload.result} onReset={reset} />
              ) : (
                <>
                  <FileDropzone
                    disabled={uploading}
                    file={file}
                    maximumUploadSizeBytes={maximumUploadSizeBytes}
                    onClear={reset}
                    onSelect={selectFile}
                  />

                  {(upload.error || providerError) && (
                    <div className="alert" role="alert">
                      <Icon name="warning" size={18} />
                      <span>{upload.error || providerError}</span>
                    </div>
                  )}

                  {uploading && (
                    <div
                      className="progress-block"
                      role="progressbar"
                      aria-label="Upload progress"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={upload.progress}
                    >
                      <div className="progress-label">
                        <span>
                          {upload.progress < 92
                            ? "Sending to the secure server"
                            : "Completing the Box handoff"}
                        </span>
                        <strong>{upload.progress}%</strong>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${upload.progress}%` }} />
                      </div>
                    </div>
                  )}

                  {!boxProvider?.configured && !providersLoading && (
                    <div className="setup-hint">
                      Add the four <code>BOX_*</code> values to your server
                      <code>.env</code> file to enable sending.
                    </div>
                  )}

                  <button
                    className="send-button"
                    disabled={!canUpload}
                    onClick={sendFile}
                    type="button"
                  >
                    <span>
                      {uploading ? "Sending securely…" : "Send to Box"}
                    </span>
                    <span className="send-button-icon">
                      <Icon name="send" size={18} />
                    </span>
                  </button>
                </>
              )}

              <div className="trust-row">
                <span>
                  <Icon name="lock" size={14} />
                  Server-side authentication
                </span>
                <span>
                  <Icon name="check" size={15} />
                  Duplicate safe
                </span>
                <span>
                  <Icon name="document" size={14} />
                  Most file types
                </span>
              </div>
            </div>

            <div id="connections">
              <ProviderPanel
                boxProvider={boxProvider}
                loading={providersLoading}
              />
              <div className="activity-card" id="activity">
                <div className="activity-icon">
                  <Icon name="clock" size={20} />
                </div>
                <div>
                  <strong>Transfer history is ready to grow</strong>
                  <p>
                    This first release focuses on reliable Box uploads. Browsing,
                    downloading and cross-provider history fit the same service
                    structure next.
                  </p>
                </div>
                <Icon name="chevron" size={18} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
