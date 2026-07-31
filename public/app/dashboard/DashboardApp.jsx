import { useMemo } from "react";
import { StorageApiClient } from "../api/StorageApiClient";
import { permissions } from "../auth/permissions";
import { useAuthSession } from "../auth/AuthSessionProvider";
import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { ActivityHistory } from "./ActivityHistory";
import { ActivityScatterChart } from "./ActivityScatterChart";
import { StorageDonutChart } from "./StorageDonutChart";
import {
  formatBytes,
  formatRefreshTime
} from "./storageInsights.mjs";
import { useStorageInsights } from "./useStorageInsights";
import { useActivityLog } from "./useActivityLog";

export function DashboardApp() {
  const { hasPermission } = useAuthSession();
  const canListFiles = hasPermission(permissions.listFiles);
  const apiClient = useMemo(() => new StorageApiClient(), []);
  const {
    error,
    insights,
    loading,
    refresh: refreshInsights,
    refreshedAt,
    refreshing
  } = useStorageInsights(apiClient, canListFiles);
  const activityLog = useActivityLog(apiClient, canListFiles);
  const refreshDashboard = () => {
    refreshInsights();
    activityLog.refresh();
  };

  return (
    <AppShell activePage="dashboard">
      <main className="dashboard-main">
        <section className="dashboard-heading">
          <div>
            <span className="section-kicker">
              <span />
              Storage usage overview
            </span>
            <h1>What makes up the cumulative storage</h1>
            <p>
              A live view of the connected cloud storage providers and their makeup.
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
                disabled={
                  loading ||
                  refreshing ||
                  activityLog.loading ||
                  activityLog.refreshing
                }
                onClick={refreshDashboard}
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
            <section
              aria-label="Storage activity"
              className="activity-dashboard"
            >
              <ActivityScatterChart
                dailyUploads={activityLog.activity.dailyUploads}
                loading={activityLog.loading}
              />
              <ActivityHistory
                error={activityLog.error}
                history={activityLog.activity.history}
                loading={activityLog.loading}
                onPageChange={activityLog.setPage}
                refreshing={activityLog.refreshing}
              />
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
