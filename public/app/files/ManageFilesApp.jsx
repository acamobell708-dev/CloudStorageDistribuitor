import { useCallback, useEffect, useMemo, useState } from "react";
import { StorageApiClient } from "../api/StorageApiClient";
import { useAuthSession } from "../auth/AuthSessionProvider";
import { permissions } from "../auth/permissions";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { BrowserFileDownloadService } from "./BrowserFileDownloadService";
import { createFileKey, FileList } from "./FileList";
import { PermanentDeletionDialog } from "./PermanentDeletionDialog";
import { ProviderSelector } from "./ProviderSelector";

export function ManageFilesApp() {
  const { hasPermission } = useAuthSession();
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
  const [folderReference, setFolderReference] = useState({});
  const [navigation, setNavigation] = useState({
    breadcrumbs: []
  });
  const [fileAction, setFileAction] = useState({
    status: "idle"
  });
  const [purgeDialog, setPurgeDialog] = useState({
    open: false
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
  const actionInProgress = ["deleting", "purging"].includes(
    fileAction.status
  );
  const selectedFile = files.find(
    (file) => createFileKey(file) === selectedFileKey
  );

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
        browse: true,
        folder: folderReference,
        signal: controller.signal
      })
      .then((result) => {
        if (!active) {
          return;
        }

        setFiles(result.files || []);
        setNavigation({
          breadcrumbs: result.breadcrumbs || [],
          folder: result.folder
        });
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
    folderReference,
    listingConfigured,
    providersLoading,
    refreshRequest,
    selectedProvider,
    selectedProviderKey
  ]);

  const selectProvider = (providerKey) => {
    setFiles([]);
    setFolderReference({});
    setNavigation({ breadcrumbs: [] });
    setFileAction({ status: "idle" });
    setPurgeDialog({ open: false });
    setSelectedFileKey(undefined);
    setRefreshRequest((current) => ({
      ...current,
      background: false
    }));
    setSelectedProviderKey(providerKey);
  };

  const selectFile = (file) => {
    if (actionInProgress) {
      return;
    }

    const fileKey = createFileKey(file);

    setFileAction({ status: "idle" });
    setSelectedFileKey((currentKey) =>
      currentKey === fileKey ? undefined : fileKey
    );
  };

  const openFolder = (folder) => {
    if (actionInProgress) {
      return;
    }

    setFiles([]);
    setFileAction({ status: "idle" });
    setSelectedFileKey(undefined);
    setFolderReference({
      id: folder.id,
      path: folder.path
    });
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
          `${result.provider.displayName}.` +
          (result.file.retainedInHistory
            ? " Its earlier Git versions remain in history."
            : ""),
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

  const closePurgeDialog = useCallback(() => {
    setPurgeDialog({ open: false });
  }, []);

  const openPurgeDialog = () => {
    if (!selectedFile || actionInProgress) {
      return;
    }

    setFileAction({ status: "idle" });
    setPurgeDialog({
      error: undefined,
      file: selectedFile,
      open: true
    });
  };

  const permanentlyDeleteFile = async () => {
    const file = purgeDialog.file;

    if (!file) {
      return;
    }

    const fileKey = createFileKey(file);

    setPurgeDialog((current) => ({
      ...current,
      error: undefined
    }));
    setFileAction({
      detail: file.name,
      fileKey,
      status: "purging",
      title: "Permanently deleting item…"
    });

    try {
      const result = await apiClient.permanentlyDeleteFile(
        selectedProviderKey,
        file
      );

      setFiles((currentFiles) =>
        currentFiles.filter(
          (currentFile) => createFileKey(currentFile) !== fileKey
        )
      );
      setSelectedFileKey(undefined);
      setPurgeDialog({ open: false });
      setFileAction({
        detail:
          `${file.name} was removed from the current repository and ` +
          "its reachable Git history.",
        status: "success",
        title: "Item permanently deleted"
      });
      refreshFiles(true);
    } catch (error) {
      setPurgeDialog((current) => ({
        ...current,
        error: error.message
      }));
      setFileAction({
        detail: error.message,
        fileKey,
        status: "error",
        title: "Permanent deletion failed"
      });
    }
  };

  const canDelete =
    selectedProvider?.supportedFileActions?.includes("delete") || false;
  const canPurgeAzureHistory = hasPermission(
    permissions.permanentlyDeleteFiles
  );
  const canPermanentlyDelete =
    selectedProvider?.supportedFileActions?.includes(
      "permanent-delete"
    ) && canPurgeAzureHistory;
  const workingFileKey = actionInProgress
    ? fileAction.fileKey
    : undefined;

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
              providersLoading || actionInProgress
            }
            onSelect={selectProvider}
            providers={providers}
            selectedProviderKey={selectedProviderKey}
          />
        </section>

        {!canPurgeAzureHistory && (
          <div className="admin-purge-notice" role="note">
            <Icon name="lock" size={16} />
            <span>
              <strong>Administrator approval required</strong>
              <small>
                Permanent Azure deletions must be completed by an
                administrator. Standard deletions remain available.
              </small>
            </span>
          </div>
        )}

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
            <div className="files-card-heading-actions">
              {selectedFile &&
                selectedProviderKey === "azure" &&
                canPermanentlyDelete && (
                  <button
                    className="permanent-delete-button"
                    disabled={actionInProgress}
                    onClick={openPurgeDialog}
                    type="button"
                  >
                    <Icon name="warning" size={15} />
                    Permanent item deletion
                  </button>
                )}
              <button
                className="refresh-button"
                disabled={
                  listing.loading ||
                  listing.refreshing ||
                  actionInProgress ||
                  !listingConfigured
                }
                onClick={() => refreshFiles(true)}
                type="button"
              >
                <Icon name="refresh" size={16} />
                Refresh
              </button>
            </div>
          </header>

          {navigation.breadcrumbs.length > 0 && (
            <nav className="folder-breadcrumbs" aria-label="Folder path">
              {navigation.breadcrumbs.map((breadcrumb, index) => (
                <span
                  key={`${breadcrumb.id || breadcrumb.path}:${index}`}
                >
                  {index > 0 && (
                    <Icon name="chevron" size={13} />
                  )}
                  <button
                    aria-current={
                      index === navigation.breadcrumbs.length - 1
                        ? "page"
                        : undefined
                    }
                    disabled={
                      actionInProgress ||
                      index === navigation.breadcrumbs.length - 1
                    }
                    onClick={() => openFolder(breadcrumb)}
                    type="button"
                  >
                    {index === 0 && <Icon name="folder" size={14} />}
                    {breadcrumb.name}
                  </button>
                </span>
              ))}
            </nav>
          )}

          {fileAction.status !== "idle" && (
            <div
              className={`file-action-status is-${fileAction.status}`}
              role={fileAction.status === "error" ? "alert" : "status"}
            >
              {actionInProgress ? (
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
              files={files}
              onDelete={deleteFile}
              onDownload={downloadFile}
              onOpenFolder={openFolder}
              onSelect={selectFile}
              providerName={selectedProvider?.displayName || "provider"}
              selectedFileKey={selectedFileKey}
              workingFileKey={workingFileKey}
            />
          )}
        </section>
      </main>
      <PermanentDeletionDialog
        error={purgeDialog.error}
        file={purgeDialog.file}
        onCancel={closePurgeDialog}
        onConfirm={permanentlyDeleteFile}
        open={purgeDialog.open}
        working={fileAction.status === "purging"}
      />
    </AppShell>
  );
}
