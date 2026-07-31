import { useState } from "react";
import { Icon } from "../components/Icon";
import { formatBytes } from "../dashboard/storageInsights.mjs";

function formatPercent(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }

  if (value < 0.1) {
    return "<0.1%";
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}

function getProviderNote(provider) {
  if (provider.capacitySource === "provider-account") {
    return "Box usage covers the account; file types reflect the configured folder.";
  }

  if (provider.capacitySource === "repository-limit") {
    return "Current branch files measured against the configured repository limit.";
  }

  return "Capacity is based on the configured provider limit.";
}

export function ProviderStorageBar({ loading, provider }) {
  const [activeKey, setActiveKey] = useState();
  const activeSegment = provider.segments.find(
    (segment) => segment.key === activeKey
  );
  const availableBytes = Math.max(
    0,
    (provider.capacityBytes || provider.usedBytes) - provider.usedBytes
  );
  const totalLabel = provider.capacityBytes
    ? formatBytes(provider.capacityBytes)
    : "limit unavailable";

  return (
    <article
      aria-busy={loading}
      className={`capacity-card capacity-card--${provider.key}`}
    >
      <header className="capacity-card-heading">
        <span className="provider-symbol">
          <Icon name={provider.key} size={20} />
        </span>
        <div>
          <span className="eyebrow">Cloud provider</span>
          <h2>{provider.label}</h2>
        </div>
        <span
          className={
            provider.available
              ? "provider-state is-live"
              : "provider-state"
          }
        >
          <i />
          {provider.available ? "Live" : "Unavailable"}
        </span>
      </header>

      <div className={loading ? "capacity-body is-loading" : "capacity-body"}>
        <div className="capacity-used">
          <span>Storage used</span>
          <strong>{formatBytes(provider.usedBytes)}</strong>
          <small>of {totalLabel}</small>
          <b>{formatPercent(provider.utilizationPercent)} full</b>
        </div>

        <div className="capacity-visual">
          {provider.available ? (
            <>
              <div
                aria-label={`${provider.label} storage composition`}
                className="storage-bar"
                onMouseLeave={() => setActiveKey(undefined)}
              >
                {provider.segments.map((segment) => {
                  const percent =
                    provider.barTotalBytes > 0
                      ? (segment.value / provider.barTotalBytes) * 100
                      : 0;
                  const detail = `${segment.label}: ${formatBytes(
                    segment.value
                  )} (${formatPercent(percent)})`;

                  return (
                    <button
                      aria-label={detail}
                      className={`storage-segment storage-segment--${segment.colorKey}`}
                      key={segment.key}
                      onBlur={() => setActiveKey(undefined)}
                      onClick={() => setActiveKey(segment.key)}
                      onFocus={() => setActiveKey(segment.key)}
                      onMouseEnter={() => setActiveKey(segment.key)}
                      style={{ "--segment-share": `${percent}%` }}
                      title={detail}
                      type="button"
                    />
                  );
                })}
              </div>
              <div aria-live="polite" className="segment-detail">
                {activeSegment ? (
                  <>
                    <i
                      className={`legend-dot legend-dot--${activeSegment.colorKey}`}
                    />
                    <strong>{activeSegment.label}</strong>
                    <span>{formatBytes(activeSegment.value)}</span>
                  </>
                ) : (
                  <>
                    <strong>
                      {formatBytes(provider.usedBytes)} used
                    </strong>
                    <span>
                      {provider.capacityBytes
                        ? `${formatBytes(availableBytes)} available`
                        : "Select a section for details"}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="capacity-unavailable">
              <div className="storage-bar">
                <span className="storage-segment storage-segment--remaining" />
              </div>
              <span>{provider.detail || "Provider is not connected"}</span>
            </div>
          )}
        </div>
      </div>

      <footer>
        <ul className="capacity-legend">
          {provider.segments
            .filter((segment) => segment.key !== "remaining")
            .map((segment) => (
              <li key={segment.key}>
                <button
                  aria-pressed={activeKey === segment.key}
                  onClick={() => setActiveKey(segment.key)}
                  onFocus={() => setActiveKey(segment.key)}
                  onMouseEnter={() => setActiveKey(segment.key)}
                  type="button"
                >
                  <i
                    className={`legend-dot legend-dot--${segment.colorKey}`}
                  />
                  <span>{segment.label}</span>
                  <strong>{formatBytes(segment.value)}</strong>
                </button>
              </li>
            ))}
        </ul>
        <p>{getProviderNote(provider)}</p>
        {provider.unmeasuredCount > 0 && (
          <small>
            {provider.unmeasuredCount} item
            {provider.unmeasuredCount === 1 ? "" : "s"} could not be
            measured.
          </small>
        )}
      </footer>
    </article>
  );
}
