import { useEffect, useMemo, useState } from "react";
import { formatBytes } from "./storageInsights.mjs";

function formatPercentage(value, total) {
  if (total <= 0) {
    return "0%";
  }

  const percentage = (value / total) * 100;
  return `${percentage < 1 ? percentage.toFixed(1) : Math.round(percentage)}%`;
}

function getDashValues(segment, total, offset, segmentCount) {
  const percentage = (segment.value / total) * 100;
  const gap = segmentCount > 1 ? Math.min(1.2, percentage / 4) : 0;
  const visibleLength = Math.max(0.35, percentage - gap);

  return {
    dashArray: `${visibleLength} ${100 - visibleLength}`,
    dashOffset: -offset,
    nextOffset: offset + percentage
  };
}

function handleLegendKeyDown(event, segment, onSelect) {
  if (!["Enter", " "].includes(event.key)) {
    return;
  }

  event.preventDefault();
  onSelect(segment.key);
}

function ChartLegend({
  activeSegment,
  onClear,
  onSelect,
  segments,
  total
}) {
  if (activeSegment) {
    return (
      <div className="chart-detail is-active" aria-live="polite">
        <div className="chart-detail-heading">
          <div>
            <span
              className={`chart-color-dot segment-${activeSegment.colorKey}`}
            />
            <strong>{activeSegment.label}</strong>
          </div>
          <button
            aria-label="Show chart legend"
            onClick={onClear}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="chart-detail-summary">
          <strong>{formatBytes(activeSegment.value)}</strong>
          <span>
            {formatPercentage(activeSegment.value, total)} ·{" "}
            {activeSegment.itemCount} item
            {activeSegment.itemCount === 1 ? "" : "s"}
          </span>
        </div>
        {activeSegment.items.length > 0 ? (
          <ul className="chart-file-list">
            {activeSegment.items.map((item, index) => (
              <li
                key={`${item.providerKey}-${item.path || item.name}-${index}`}
              >
                <span>
                  <strong title={item.name}>{item.name}</strong>
                  {item.providerLabel !== activeSegment.label && (
                    <small>{item.providerLabel}</small>
                  )}
                </span>
                <em>{item.measured ? formatBytes(item.size) : "Unknown"}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p className="chart-detail-empty">
            {activeSegment.detail || "No files are stored here yet."}
          </p>
        )}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="chart-detail">
        <div className="chart-legend-heading">
          <strong>Breakdown</strong>
        </div>
        <p className="chart-detail-empty">
          No files are available to build this chart yet.
        </p>
      </div>
    );
  }

  return (
    <div className="chart-detail">
      <div className="chart-legend-heading">
        <strong>Breakdown</strong>
        <span>Hover or focus a segment</span>
      </div>
      <ul className="chart-legend">
        {segments.map((segment) => (
          <li
            key={segment.key}
            onClick={() => onSelect(segment.key)}
            onFocus={() => onSelect(segment.key)}
            onKeyDown={(event) =>
              handleLegendKeyDown(event, segment, onSelect)
            }
            onMouseEnter={() => onSelect(segment.key)}
            role="button"
            tabIndex="0"
          >
            <span
              className={`chart-color-dot segment-${segment.colorKey}`}
            />
            <span>
              <strong>{segment.label}</strong>
              <small>
                {segment.detail ||
                  `${segment.itemCount} item${
                    segment.itemCount === 1 ? "" : "s"
                  }`}
              </small>
            </span>
            <em>{formatBytes(segment.value)}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StorageDonutChart({
  description,
  eyebrow,
  loading,
  segments,
  title,
  totalBytes,
  totalFiles,
  unmeasuredCount
}) {
  const [activeKey, setActiveKey] = useState();
  const activeSegment = segments.find(
    (segment) => segment.key === activeKey
  );
  const visibleSegments = segments.filter(
    (segment) => segment.value > 0
  );
  const renderedSegments = useMemo(() => {
    let offset = 0;

    return visibleSegments.map((segment) => {
      const values = getDashValues(
        segment,
        totalBytes,
        offset,
        visibleSegments.length
      );

      offset = values.nextOffset;
      return {
        ...segment,
        ...values
      };
    });
  }, [totalBytes, visibleSegments]);

  useEffect(() => {
    if (activeKey && !segments.some((segment) => segment.key === activeKey)) {
      setActiveKey(undefined);
    }
  }, [activeKey, segments]);

  return (
    <article className="insight-card">
      <header className="insight-card-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="live-data-pill">
          <i />
          Live
        </span>
      </header>

      {loading ? (
        <div className="chart-loading" aria-label={`Loading ${title}`}>
          <span className="chart-loading-ring" />
          <span className="chart-loading-lines">
            <i />
            <i />
            <i />
          </span>
        </div>
      ) : (
        <div className="insight-card-body">
          <div className="donut-wrap">
            <svg
              aria-label={`${title}: ${formatBytes(totalBytes)} across ${totalFiles} items`}
              className="donut-chart"
              role="group"
              viewBox="0 0 100 100"
            >
              <circle
                className="donut-track"
                cx="50"
                cy="50"
                fill="none"
                r="38"
                strokeWidth="13"
              />
              {renderedSegments.map((segment) => (
                <circle
                  aria-label={`${segment.label}: ${formatBytes(
                    segment.value
                  )}, ${formatPercentage(segment.value, totalBytes)}`}
                  className={`donut-segment segment-${segment.colorKey}`}
                  cx="50"
                  cy="50"
                  fill="none"
                  key={segment.key}
                  onClick={() =>
                    setActiveKey((current) =>
                      current === segment.key ? undefined : segment.key
                    )
                  }
                  onFocus={() => setActiveKey(segment.key)}
                  onMouseEnter={() => setActiveKey(segment.key)}
                  pathLength="100"
                  r="38"
                  role="button"
                  strokeDasharray={segment.dashArray}
                  strokeDashoffset={segment.dashOffset}
                  strokeLinecap={
                    visibleSegments.length === 1 ? "round" : "butt"
                  }
                  strokeWidth="13"
                  tabIndex="0"
                >
                  <title>
                    {segment.label}: {formatBytes(segment.value)} (
                    {formatPercentage(segment.value, totalBytes)})
                  </title>
                </circle>
              ))}
            </svg>
            <div className="donut-center" aria-hidden="true">
              <span>{activeSegment ? activeSegment.label : "Total used"}</span>
              <strong>
                {formatBytes(activeSegment?.value ?? totalBytes)}
              </strong>
              <small>
                {activeSegment
                  ? formatPercentage(activeSegment.value, totalBytes)
                  : `${totalFiles} item${totalFiles === 1 ? "" : "s"}`}
              </small>
            </div>
          </div>

          <ChartLegend
            activeSegment={activeSegment}
            onClear={() => setActiveKey(undefined)}
            onSelect={setActiveKey}
            segments={segments}
            total={totalBytes}
          />
        </div>
      )}

      {!loading && unmeasuredCount > 0 && (
        <p className="measurement-note">
          {unmeasuredCount} item{unmeasuredCount === 1 ? " has" : "s have"}{" "}
          no reported size and {unmeasuredCount === 1 ? "is" : "are"} excluded
          from byte totals.
        </p>
      )}
    </article>
  );
}
