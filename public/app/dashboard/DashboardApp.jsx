import { useMemo } from "react";
import { StorageApiClient } from "../api/StorageApiClient";
import { permissions } from "../auth/permissions";
import { useAuthSession } from "../auth/AuthSessionProvider";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { StorageDonutChart } from "./StorageDonutChart";
import { formatBytes } from "./storageInsights.mjs";
import { useStorageInsights } from "./useStorageInsights";

function formatRefreshTime(value) {
  if (!value) {
    return "Waiting for provider data";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Provider data refreshed";
  }

  return `Updated ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date)}`;
}

export function DashboardApp() {
  const { hasPermission } = useAuthSession();
  const canListFiles = hasPermission(permissions.listFiles);
  const apiClient = useMemo(() => new StorageApiClient(), []);
  const {
    error,
    insights,
    loading,
    refresh,
    refreshedAt,
    refreshing
  } = useStorageInsights(apiClient, canListFiles);

  return (
    <AppShell activePage="dashboard">
      <main className="dashboard-main">
        <section className="dashboard-heading">
          <div>
            <span className="section-kicker">
              <span />
              Usage overview
            </span>
            <h1>See where your storage lives.</h1>
            <p>
              A live view of your connected storage providers and the files
              that make up their footprint.
            </p>
          </div>
          {canListFiles && (
            <div className="dashboard-summary">
              <span className="dashboard-total">
                <small>Total storage</small>
                <strong>{formatBytes(insights.totalBytes)}</strong>
                <em>
                  {insights.totalFiles} item
                  {insights.totalFiles === 1 ? "" : "s"}
                </em>
              </span>
              <button
                aria-label="Refresh storage insights"
                className="refresh-button"
                disabled={loading || refreshing}
                onClick={refresh}
                type="button"
              >
                <Icon name="refresh" size={16} />
                <span>{refreshing ? "Refreshing" : "Refresh"}</span>
              </button>
              <small className="refresh-time">
                {formatRefreshTime(refreshedAt)}
              </small>
            </div>
          )}
        </section>

        {!canListFiles ? (
          <section className="dashboard-access-card">
            <span>
              <Icon name="lock" size={20} />
            </span>
            <div>
              <span className="eyebrow">Member insight</span>
              <h2>Storage details are protected</h2>
              <p>
                Sign in with a member account to view provider totals and file
                composition. Guest access never receives cloud file names.
              </p>
            </div>
          </section>
        ) : (
          <>
            {error && (
              <div className="dashboard-warning" role="status">
                <Icon name="warning" size={16} />
                <span>{error} Available data is shown below.</span>
              </div>
            )}
            <section className="insight-grid" aria-label="Storage insights">
              <StorageDonutChart
                description="Storage volume split across your connected destinations."
                eyebrow="Provider allocation"
                loading={loading}
                segments={insights.providerSegments}
                title="Azure vs Box"
                totalBytes={insights.totalBytes}
                totalFiles={insights.totalFiles}
                unmeasuredCount={insights.unmeasuredCount}
              />
              <StorageDonutChart
                description="The file formats contributing to your total footprint."
                eyebrow="Media composition"
                loading={loading}
                segments={insights.mediaSegments}
                title="Storage by media type"
                totalBytes={insights.totalBytes}
                totalFiles={insights.totalFiles}
                unmeasuredCount={insights.unmeasuredCount}
              />
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
