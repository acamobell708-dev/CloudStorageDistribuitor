import { Icon } from "../components/Icon";

export function ProviderSelector({
  disabled,
  onSelect,
  providers,
  selectedProviderKey
}) {
  return (
    <div
      aria-label="Choose a cloud storage provider"
      className="provider-switcher"
      role="group"
    >
      {providers.map((provider) => {
        const listingConfigured =
          provider.listingConfigured ?? provider.configured;
        const selected = provider.key === selectedProviderKey;

        return (
          <button
            aria-pressed={selected}
            className={selected ? "is-selected" : ""}
            disabled={disabled || !listingConfigured}
            key={provider.key}
            onClick={() => onSelect(provider.key)}
            title={
              listingConfigured
                ? `List the latest files from ${provider.displayName}`
                : `${provider.displayName} listing is not configured`
            }
            type="button"
          >
            <Icon
              name={provider.key === "azure" ? "azure" : "box"}
              size={18}
            />
            <span>{provider.displayName}</span>
            <i aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
