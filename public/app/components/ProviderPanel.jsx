import { Icon } from "./Icon";
import { formatBytes } from "./FileDropzone";

const providerPresentation = {
  azure: {
    icon: "azure",
    logoClass: "azure-logo",
    guidance: (provider) => {
      const uploadLimit = Number.isFinite(provider.maximumUploadSizeBytes)
        ? ` Uploads are limited to ${formatBytes(
            provider.maximumUploadSizeBytes
          )} per file.`
        : "";

      return `Best for files, documents and code.${uploadLimit} You can clear selections before sending; after upload, current-branch deletion is available while permanent Git-history deletion requires an administrator.`;
    }
  },
  box: {
    icon: "box",
    logoClass: "box-logo",
    guidance: () =>
      "Best for videos and other media, especially content you may want to delete easily later."
  }
};

export function ProviderPanel({
  disabled,
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
            disabled={disabled}
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
              <small className="provider-guidance">
                {presentation.guidance(provider)}
              </small>
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
