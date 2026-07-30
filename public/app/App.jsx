import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "./auth/AuthSessionProvider";
import { permissions } from "./auth/permissions";
import { StorageApiClient } from "./api/StorageApiClient";
import {
  FileDropzone,
  formatBytes
} from "./components/FileDropzone";
import { AppShell } from "./components/AppShell";
import { Icon } from "./components/Icon";
import { ProviderPanel } from "./components/ProviderPanel";
import { UploadResult } from "./components/UploadResult";
import { UploadModeSelector } from "./components/UploadModeSelector";

const defaultMaximumUploadSizeBytes = 50 * 1024 * 1024;
const maximumBrowserUploadFiles = 250;

export default function App() {
  const { hasPermission, user } = useAuthSession();
  const apiClient = useMemo(() => new StorageApiClient(), []);
  const [files, setFiles] = useState([]);
  const [uploadMode, setUploadMode] = useState("single");
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
  const canWrite = hasPermission(permissions.uploadFiles);
  const query = new URLSearchParams(window.location.search);
  const loginAccepted = query.get("login") === "accepted";
  const guestAccepted = query.get("login") === "guest";
  const accessDenied = query.get("access") === "denied";
  const canUpload = Boolean(
    canWrite &&
      files.length > 0 &&
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

  function selectFiles(selectedFiles) {
    if (!canWrite) {
      return;
    }

    if (selectedFiles.length > maximumBrowserUploadFiles) {
      setUpload((current) => ({
        ...current,
        error:
          `Choose no more than ${maximumBrowserUploadFiles} files per upload`,
        status: "error"
      }));
      return;
    }

    const emptyFile = selectedFiles.find(
      (selection) => selection.file.size === 0
    );

    if (emptyFile) {
      setUpload((current) => ({
        ...current,
        error: `${emptyFile.file.name} is empty`,
        status: "error"
      }));
      return;
    }

    const oversizedFile = selectedFiles.find(
      (selection) =>
        selection.file.size > maximumUploadSizeBytes
    );

    if (oversizedFile) {
      setUpload((current) => ({
        ...current,
        error:
          `${oversizedFile.file.name} must be ${formatBytes(
            maximumUploadSizeBytes
          )} or smaller`,
        status: "error"
      }));
      return;
    }

    setFiles(selectedFiles);
    setUpload({
      error: undefined,
      progress: 0,
      result: undefined,
      status: "idle"
    });
  }

  function reset() {
    setFiles([]);
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

  function selectUploadMode(mode) {
    setUploadMode(mode);
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
      const result = await apiClient.uploadFiles({
        files,
        mode: uploadMode,
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
          {(loginAccepted || guestAccepted || accessDenied || !canWrite) && (
            <div
              className={`access-notice ${
                accessDenied ? "is-warning" : ""
              }`}
              role="status"
            >
              <Icon
                name={accessDenied ? "lock" : "check"}
                size={17}
              />
              <span>
                <strong>
                  {loginAccepted
                    ? `Password accepted. Welcome, ${user.displayName}.`
                    : guestAccepted
                      ? "Guest access granted."
                      : accessDenied
                        ? "That page is not available to your account."
                        : "Guest view is read-only."}
                </strong>
                {!canWrite && (
                  <small>
                    You can view Home and Dashboard, but storage actions are
                    disabled.
                  </small>
                )}
              </span>
            </div>
          )}
          <section className="hero">
            <div>
              <span className="section-kicker">
                <span />
                Secure cloud transfer
              </span>
              <h1>
                Every upload. <em>Right where it belongs.</em>
              </h1>
              <p>
                Send files and folders to Box or Azure Repos—without
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
                  <h2>Choose what to upload</h2>
                </div>
                <span className="step-label">Step 1 of 1</span>
              </div>

              {upload.result ? (
                <UploadResult result={upload.result} onReset={reset} />
              ) : (
                <>
                  <label className="provider-select">
                    <span>Send this upload to</span>
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
                        disabled={
                          !canWrite || uploading || providersLoading
                        }
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

                  <UploadModeSelector
                    disabled={!canWrite || uploading || providersLoading}
                    onSelect={selectUploadMode}
                    selectedMode={uploadMode}
                  />

                  <FileDropzone
                    acceptedDescription={
                      selectedProviderKey === "azure"
                        ? "Documents, source code, images, audio and video"
                        : "Documents, media, archives and more"
                    }
                    acceptedFileTypes={
                      selectedProvider?.acceptedFileTypes || ["*/*"]
                    }
                    disabled={
                      !canWrite || uploading || providersLoading
                    }
                    files={files}
                    maximumUploadSizeBytes={maximumUploadSizeBytes}
                    onClear={reset}
                    mode={uploadMode}
                    onSelect={selectFiles}
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
                            : `Completing the ${
                                selectedProvider?.displayName || "cloud"
                              } handoff`}
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
                        : `Send ${
                            files.length > 1
                              ? `${files.length} files`
                              : uploadMode === "folder"
                                ? "folder"
                                : "file"
                          } to ${
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
                disabled={!canWrite}
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
