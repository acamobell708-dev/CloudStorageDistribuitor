import { useEffect, useMemo, useState } from "react";
import { StorageApiClient } from "./api/StorageApiClient";
import {
  FileDropzone,
  formatBytes
} from "./components/FileDropzone";
import { AppShell } from "./components/AppShell";
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
  const [selectedProviderKey, setSelectedProviderKey] = useState("box");
  const [upload, setUpload] = useState({
    error: undefined,
    progress: 0,
    result: undefined,
    status: "idle"
  });
  const selectedProvider = providers.find(
    (provider) => provider.key === selectedProviderKey
  );
  const maximumUploadSizeBytes =
    selectedProvider?.maximumUploadSizeBytes ||
    defaultMaximumUploadSizeBytes;
  const uploading = upload.status === "uploading";
  const canUpload = Boolean(
    file &&
      selectedProvider?.configured &&
      !selectedProvider?.connectionError &&
      !uploading
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
      setUpload((current) => ({
        ...current,
        error:
          `Choose a file that is ${formatBytes(
            maximumUploadSizeBytes
          )} or smaller`,
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

  function selectProvider(providerKey) {
    setSelectedProviderKey(providerKey);
    reset();
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
        provider: selectedProviderKey
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
    <AppShell activePage="upload">
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
                Send files to Box or version media in Azure Repos—without
                exposing a single credential or mixing storage data into this
                application repository.
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
                  <label className="provider-select">
                    <span>Send this file to</span>
                    <span className="provider-select-control">
                      <Icon
                        name={
                          selectedProviderKey === "azure"
                            ? "azure"
                            : "box"
                        }
                        size={18}
                      />
                      <select
                        aria-label="Storage provider"
                        disabled={uploading || providersLoading}
                        onChange={(event) =>
                          selectProvider(event.target.value)
                        }
                        value={selectedProviderKey}
                      >
                        {providers.map((provider) => (
                          <option key={provider.key} value={provider.key}>
                            {provider.displayName}
                            {provider.configured ? "" : " — setup needed"}
                          </option>
                        ))}
                      </select>
                      <span className="select-chevron">⌄</span>
                    </span>
                  </label>

                  <FileDropzone
                    acceptedDescription={
                      selectedProviderKey === "azure"
                        ? "Documents, source code, images, audio and video"
                        : "Documents, media, archives and more"
                    }
                    acceptedFileTypes={
                      selectedProvider?.acceptedFileTypes || ["*/*"]
                    }
                    disabled={uploading || providersLoading}
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

                  {(!selectedProvider?.configured ||
                    selectedProvider?.connectionError) &&
                    !providersLoading && (
                    <div className="setup-hint">
                      Configure the server-side{" "}
                      <code>
                        {selectedProviderKey === "azure"
                          ? "AZURE_*"
                          : "BOX_*"}
                      </code>{" "}
                      values in <code>.env</code> to enable this destination.
                    </div>
                  )}

                  <button
                    className="send-button"
                    disabled={!canUpload}
                    onClick={sendFile}
                    type="button"
                  >
                    <span>
                      {uploading
                        ? "Sending securely…"
                        : `Send to ${
                            selectedProvider?.displayName || "storage"
                          }`}
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
                loading={providersLoading}
                onSelect={selectProvider}
                providers={providers}
                selectedProviderKey={selectedProviderKey}
              />
              <div className="activity-card" id="activity">
                <div className="activity-icon">
                  <Icon name="clock" size={20} />
                </div>
                <div>
                  <strong>Transfer history is ready to grow</strong>
                  <p>
                    Box uploads and versioned Azure files now share one secure
                    transfer path. Browsing, downloads, and unified history fit
                    the same provider structure next.
                  </p>
                </div>
                <Icon name="chevron" size={18} />
              </div>
            </div>
          </section>
      </main>
    </AppShell>
  );
}
