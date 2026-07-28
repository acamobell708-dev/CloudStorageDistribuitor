import { AppShell } from "../components/AppShell";

export function DashboardApp() {
  return (
    <AppShell activePage="dashboard">
      <main className="dashboard-main">
        <section className="dashboard-heading">
          <span className="section-kicker">
            <span />
            Usage overview
          </span>
          <h1>Storage dashboard</h1>
          <p>
            Provider usage and transfer insights will appear here as the
            reporting API is developed.
          </p>
        </section>

        <section className="usage-card" aria-labelledby="usage-chart-title">
          <header className="usage-card-heading">
            <div>
              <span className="eyebrow">Placeholder data</span>
              <h2 id="usage-chart-title">Storage used by provider</h2>
            </div>
            <span className="chart-period">Current month</span>
          </header>

          <div
            className="bar-chart"
            role="img"
            aria-label="Placeholder bar chart showing storage usage across Box, Azure, and future providers"
          >
            <div className="chart-grid" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="chart-bars" aria-hidden="true">
              <div className="chart-column">
                <span className="chart-value">68%</span>
                <span className="chart-bar chart-bar-box" />
                <strong>Box</strong>
              </div>
              <div className="chart-column">
                <span className="chart-value">43%</span>
                <span className="chart-bar chart-bar-azure" />
                <strong>Azure</strong>
              </div>
              <div className="chart-column is-placeholder">
                <span className="chart-value">24%</span>
                <span className="chart-bar chart-bar-future-one" />
                <strong>Future</strong>
              </div>
              <div className="chart-column is-placeholder">
                <span className="chart-value">14%</span>
                <span className="chart-bar chart-bar-future-two" />
                <strong>Future</strong>
              </div>
            </div>
          </div>

          <p className="chart-note">
            This chart is a visual placeholder and is not connected to live
            provider usage yet.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
