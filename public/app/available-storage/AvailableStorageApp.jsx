import { useMemo } from "react";
import { StorageApiClient } from "../api/StorageApiClient";
import { permissions } from "../auth/permissions";
import { useAuthSession } from "../auth/AuthSessionProvider";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { formatRefreshTime } from "../dashboard/storageInsights.mjs";
import { useStorageInsights } from "../dashboard/useStorageInsights";
import { ProviderStorageBar } from "./ProviderStorageBar";

export function AvailableStorageApp() {
  const { hasPermission } = useAuthSession();
  const apiClient = useMemo(() => new StorageApiClient(), []);
  const {
    error,
    insights,
    loading,
    refresh,
    refreshedAt,
    refreshing
  } = useStorageInsights(
    apiClient,
    hasPermission(permissions.listFiles)
  );

  return (
    <AppShell activePage="storage">
      <main className="capacity-main">
        <section className="capacity-heading">
          <div>
            <span className="section-kicker">
              <span />
              Provider capacity overview
            </span>
            <h1>Whats taking up the space:</h1>
            <p>
              Compare provider capacity and explore the file types behind
              each stored byte.
            </p>
          </div>
          <div className="capacity-refresh-wrap">
            <button
              className="capacity-refresh"
              disabled={loading || refreshing}
              onClick={refresh}
              type="button"
            >
              <Icon name="refresh" size={16} />
              <span>{refreshing ? "Refreshing" : "Refresh"}</span>
            </button>
            <small>{formatRefreshTime(refreshedAt)}</small>
          </div>
        </section>

        {error && (
          <div className="capacity-warning" role="status">
            <Icon name="warning" size={16} />
            <span>{error} Available data is shown below.</span>
          </div>
        )}

        <section
          aria-label="Available storage by provider"
          className="capacity-list"
        >
          {insights.providerCapacity.map((provider) => (
            <ProviderStorageBar
              key={provider.key}
              loading={loading}
              provider={provider}
            />
          ))}
        </section>
      </main>
    </AppShell>
  );
}
