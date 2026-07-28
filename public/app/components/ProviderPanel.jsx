import { Icon } from "./Icon";

const providerPresentation = {
  azure: {
    icon: "azure",
    logoClass: "azure-logo"
  },
  box: {
    icon: "box",
    logoClass: "box-logo"
  }
};

export function ProviderPanel({
  loading,
  onSelect,
  providers,
  selectedProviderKey
}) {
  const selectedProvider = providers.find(
    (provider) => provider.key === selectedProviderKey
  );
  const connected =
    selectedProvider?.configured && !selectedProvider?.connectionError;

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

      {providers.map((provider) => {
        const presentation =
          providerPresentation[provider.key] || providerPresentation.box;
        const selected = provider.key === selectedProviderKey;
        const available =
          provider.configured && !provider.connectionError;

        return (
          <button
            className={`provider-card ${selected ? "is-selected" : ""} ${
              available ? "" : "is-muted"
            }`}
            key={provider.key}
            onClick={() => onSelect(provider.key)}
            type="button"
          >
            <span
              className={`provider-logo ${presentation.logoClass}`}
            >
              <Icon name={presentation.icon} size={25} />
            </span>
            <span className="provider-card-copy">
              <strong>{provider.displayName}</strong>
              <span>
                {available
                  ? provider.description
                  : provider.connectionError || "Add server configuration"}
              </span>
            </span>
            {selected ? (
              <span className="provider-check">
                <Icon name="check" size={15} strokeWidth={2.4} />
              </span>
            ) : null}
          </button>
        );
      })}

      <div className="security-note">
        <div className="security-icon">
          <Icon name="shield" size={20} />
        </div>
        <div>
          <strong>Credentials stay private</strong>
          <p>
            Files pass through this server. Box secrets, Azure tokens, and Git
            credentials are never exposed to the page.
          </p>
        </div>
      </div>
    </aside>
  );
}
