import { useEffect, useMemo, useState } from "react";
import { StorageApiClient } from "../api/StorageApiClient";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { FileList } from "./FileList";
import { ProviderSelector } from "./ProviderSelector";

export function ViewFilesApp() {
  const apiClient = useMemo(() => new StorageApiClient(), []);
  const [files, setFiles] = useState([]);
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedProviderKey, setSelectedProviderKey] = useState("box");
  const [refreshCount, setRefreshCount] = useState(0);
  const [listing, setListing] = useState({
    error: undefined,
    loading: false,
    refreshedAt: undefined
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
            refreshedAt: undefined
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
          refreshedAt: undefined
        });
      }

      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setListing((current) => ({
      ...current,
      error: undefined,
      loading: true
    }));

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
          refreshedAt: result.refreshedAt
        });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError") {
          setFiles([]);
          setListing({
            error: error.message,
            loading: false,
            refreshedAt: undefined
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
    refreshCount,
    selectedProvider,
    selectedProviderKey
  ]);

  return (
    <AppShell activePage="files">
      <main className="files-main">
        <section className="files-heading">
          <div>
            <span className="section-kicker">
              <span />
              Live cloud contents
            </span>
            <h1>View files</h1>
            <p>
              Choose a provider to read the latest contents directly from its
              cloud service. Credentials and access tokens remain on the
              server.
            </p>
          </div>

          <ProviderSelector
            disabled={providersLoading}
            onSelect={setSelectedProviderKey}
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
                  ? `Refreshed ${new Date(
                      listing.refreshedAt
                    ).toLocaleTimeString()}`
                  : "Waiting for the latest cloud listing"}
              </p>
            </div>
            <button
              className="refresh-button"
              disabled={listing.loading || !listingConfigured}
              onClick={() => setRefreshCount((count) => count + 1)}
              type="button"
            >
              <Icon name="refresh" size={16} />
              Refresh
            </button>
          </header>

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
          ) : listing.error ? null : (
            <FileList
              files={files}
              providerName={selectedProvider?.displayName || "provider"}
            />
          )}
        </section>
      </main>
    </AppShell>
  );
}
