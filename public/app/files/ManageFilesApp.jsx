import { useEffect, useMemo, useState } from "react";
import { StorageApiClient } from "../api/StorageApiClient";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { BrowserFileDownloadService } from "./BrowserFileDownloadService";
import { createFileKey, FileList } from "./FileList";
import { ProviderSelector } from "./ProviderSelector";

export function ManageFilesApp() {
  const apiClient = useMemo(() => new StorageApiClient(), []);
  const downloadService = useMemo(
    () => new BrowserFileDownloadService(apiClient),
    [apiClient]
  );
  const [files, setFiles] = useState([]);
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedProviderKey, setSelectedProviderKey] = useState("box");
  const [selectedFileKey, setSelectedFileKey] = useState();
  const [fileAction, setFileAction] = useState({
    status: "idle"
  });
  const [refreshRequest, setRefreshRequest] = useState({
    background: false,
    sequence: 0
  });
  const [listing, setListing] = useState({
    error: undefined,
    loading: false,
    refreshedAt: undefined,
    refreshing: false
  });
  const selectedProvider = providers.find(
    (provider) => provider.key === selectedProviderKey
  );
  const listingConfigured =
    selectedProvider?.listingConfigured ?? selectedProvider?.configured;

  useEffect(() => {
    let active = true;

    apiClient
      .listProviders()
      .then((availableProviders) => {
        if (!active) {
          return;
        }

        setProviders(availableProviders);
        setSelectedProviderKey((currentKey) =>
          availableProviders.some(
            (provider) => provider.key === currentKey
          )
            ? currentKey
            : availableProviders[0]?.key || ""
        );
      })
      .catch((error) => {
        if (active) {
          setListing({
            error: error.message,
            loading: false,
            refreshedAt: undefined,
            refreshing: false
          });
        }
      })
      .finally(() => {
        if (active) {
          setProvidersLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [apiClient]);

  useEffect(() => {
    if (
      providersLoading ||
      !selectedProvider ||
      !listingConfigured
    ) {
      if (selectedProvider && !listingConfigured) {
        setFiles([]);
        setListing({
          error:
            `Configure the server-side ${selectedProvider.key === "azure" ? "AZURE_*" : "BOX_*"} ` +
            `values to list ${selectedProvider.displayName} files.`,
          loading: false,
          refreshedAt: undefined,
          refreshing: false
        });
      }

      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    const backgroundRefresh = refreshRequest.background;

    setListing((current) => ({
      ...current,
      error: undefined,
      loading: !backgroundRefresh,
      refreshing: backgroundRefresh
    }));
    setSelectedFileKey(undefined);

    apiClient
      .listFiles(selectedProviderKey, {
        signal: controller.signal
      })
      .then((result) => {
        if (!active) {
          return;
        }

        setFiles(result.files || []);
        setListing({
          error: undefined,
          loading: false,
          refreshedAt: result.refreshedAt,
          refreshing: false
        });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError") {
          if (!backgroundRefresh) {
            setFiles([]);
          }
          setListing({
            error: error.message,
            loading: false,
            refreshedAt: undefined,
            refreshing: false
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    apiClient,
    listingConfigured,
    providersLoading,
    refreshRequest,
    selectedProvider,
    selectedProviderKey
  ]);

  const selectProvider = (providerKey) => {
    setFiles([]);
    setFileAction({ status: "idle" });
    setSelectedFileKey(undefined);
    setRefreshRequest((current) => ({
      ...current,
      background: false
    }));
    setSelectedProviderKey(providerKey);
  };

  const selectFile = (file) => {
    if (fileAction.status === "deleting") {
      return;
    }

    const fileKey = createFileKey(file);

    setFileAction({ status: "idle" });
    setSelectedFileKey((currentKey) =>
      currentKey === fileKey ? undefined : fileKey
    );
  };

  const refreshFiles = (background = true) => {
    setRefreshRequest((current) => ({
      background,
      sequence: current.sequence + 1
    }));
  };

  const downloadFile = (file) => {
    downloadService.download(selectedProviderKey, file);
  };

  const deleteFile = async (file) => {
    const fileKey = createFileKey(file);

    setFileAction({
      detail: file.name,
      fileKey,
      status: "deleting",
      title: "Deleting item…"
    });

    try {
      const result = await apiClient.deleteFile(
        selectedProviderKey,
        file
      );
      setFiles((currentFiles) =>
        currentFiles.filter(
          (currentFile) => createFileKey(currentFile) !== fileKey
        )
      );
      setSelectedFileKey(undefined);
      setFileAction({
        detail:
          `${file.name} was deleted from ` +
          `${result.provider.displayName}.`,
        status: "success",
        title: "Item deleted"
      });
      refreshFiles(true);
    } catch (error) {
      setFileAction({
        detail: error.message,
        fileKey,
        status: "error",
        title: "Delete failed"
      });
    }
  };

  const canDelete =
    selectedProvider?.supportedFileActions?.includes("delete") || false;
  const deletingFileKey =
    fileAction.status === "deleting" ? fileAction.fileKey : undefined;

  return (
    <AppShell activePage="files">
      <main className="files-main">
        <section className="files-heading">
          <div>
            <span className="section-kicker">
              <span />
              Live cloud contents
            </span>
            <h1>Manage files</h1>
            <p>
              Choose a provider to read the latest contents directly from its
              cloud service. Select a row to manage that file while credentials
              and access tokens remain on the server.
            </p>
          </div>

          <ProviderSelector
            disabled={
              providersLoading || fileAction.status === "deleting"
            }
            onSelect={selectProvider}
            providers={providers}
            selectedProviderKey={selectedProviderKey}
          />
        </section>

        <section className="files-card" aria-live="polite">
          <header className="files-card-heading">
            <div>
              <span className="eyebrow">Cloud repository</span>
              <h2>{selectedProvider?.displayName || "Storage files"}</h2>
              <p>
                {listing.refreshedAt
                  ? listing.refreshing
                    ? "Refreshing cloud contents…"
                    : `Refreshed ${new Date(
                        listing.refreshedAt
                      ).toLocaleTimeString()}`
                  : "Waiting for the latest cloud listing"}
              </p>
            </div>
            <button
              className="refresh-button"
              disabled={
                listing.loading ||
                listing.refreshing ||
                fileAction.status === "deleting" ||
                !listingConfigured
              }
              onClick={() => refreshFiles(true)}
              type="button"
            >
              <Icon name="refresh" size={16} />
              Refresh
            </button>
          </header>

          {fileAction.status !== "idle" && (
            <div
              className={`file-action-status is-${fileAction.status}`}
              role={fileAction.status === "error" ? "alert" : "status"}
            >
              {fileAction.status === "deleting" ? (
                <span className="file-action-spinner" />
              ) : (
                <Icon
                  name={
                    fileAction.status === "success"
                      ? "check"
                      : "warning"
                  }
                  size={16}
                />
              )}
              <span>
                <strong>{fileAction.title}</strong>
                <small>{fileAction.detail}</small>
              </span>
            </div>
          )}

          {listing.error && (
            <div className="alert files-alert" role="alert">
              <Icon name="warning" size={18} />
              <span>{listing.error}</span>
            </div>
          )}

          {listing.loading ? (
            <div className="files-loading" role="status">
              <span className="loading-spinner" />
              <strong>Reading the latest cloud files…</strong>
            </div>
          ) : listing.error && files.length === 0 ? null : (
            <FileList
              canDelete={canDelete}
              deletingFileKey={deletingFileKey}
              files={files}
              onDelete={deleteFile}
              onDownload={downloadFile}
              onSelect={selectFile}
              providerName={selectedProvider?.displayName || "provider"}
              selectedFileKey={selectedFileKey}
            />
          )}
        </section>
      </main>
    </AppShell>
  );
}
