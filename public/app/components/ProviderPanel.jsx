import { Icon } from "./Icon";

export function ProviderPanel({ boxProvider, loading }) {
  const connected = boxProvider?.configured;

  return (
    <aside className="provider-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Destination</span>
          <h2>Connected storage</h2>
        </div>
        <span className={`status-pill ${connected ? "is-online" : ""}`}>
          <span />
          {loading ? "Checking" : connected ? "Ready" : "Setup needed"}
        </span>
      </div>

      <div className="provider-card is-selected">
        <div className="provider-logo box-logo">
          <Icon name="box" size={25} />
        </div>
        <div>
          <strong>Box</strong>
          <span>
            {connected
              ? "Secure service account"
              : "Add credentials in .env"}
          </span>
        </div>
        <div className="provider-check">
          {connected ? <Icon name="check" size={15} strokeWidth={2.4} /> : null}
        </div>
      </div>

      <div className="provider-card is-muted">
        <div className="provider-logo azure-logo">
          <Icon name="azure" size={25} />
        </div>
        <div>
          <strong>Azure Repos</strong>
          <span>Browser upload coming next</span>
        </div>
        <span className="soon-tag">Soon</span>
      </div>

      <div className="security-note">
        <div className="security-icon">
          <Icon name="shield" size={20} />
        </div>
        <div>
          <strong>Credentials stay private</strong>
          <p>
            Your browser sends files to this server. Box secrets and access
            tokens are never exposed to the page.
          </p>
        </div>
      </div>
    </aside>
  );
}
