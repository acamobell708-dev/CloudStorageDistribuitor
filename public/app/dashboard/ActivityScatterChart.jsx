import { useMemo, useState } from "react";
import { formatBytes } from "./storageInsights.mjs";

const chart = Object.freeze({
  bottom: 44,
  height: 280,
  left: 45,
  right: 24,
  top: 24,
  width: 840
});
const userOffsets = [-9, 0, 9];

function formatDay(value) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatLegendName(user) {
  const matchedName = String(user?.displayName || "").match(
    /\b(adam|andrew|wilson)\b/i
  );

  return matchedName
    ? `${matchedName[1][0].toUpperCase()}${matchedName[1].slice(1).toLowerCase()}`
    : user?.displayName || "Unknown user";
}

function formatProviderName(provider) {
  if (provider?.key === "azure") {
    return "Azure";
  }

  if (provider?.key === "box") {
    return "Box";
  }

  return provider?.displayName || "Cloud storage";
}

export function ActivityScatterChart({ dailyUploads, loading }) {
  const [activeId, setActiveId] = useState();
  const model = useMemo(() => {
    const days = dailyUploads?.days || [];
    const series = [];
    const seriesIndex = new Map();

    for (const day of days) {
      for (const point of day.points) {
        const key = `${point.user.id}:${point.provider?.key || "unknown"}`;

        if (!seriesIndex.has(key)) {
          seriesIndex.set(key, series.length);
          series.push({
            ...point,
            key,
            label: `${formatLegendName(point.user)} · ${formatProviderName(point.provider)}`
          });
        }
      }
    }

    const maximum = Math.max(
      1,
      ...days.flatMap((day) => day.points.map((point) => point.count))
    );
    const plotWidth = chart.width - chart.left - chart.right;
    const plotHeight = chart.height - chart.top - chart.bottom;
    const points = days.flatMap((day, dayIndex) =>
      day.points.map((point) => {
        const seriesKey = `${point.user.id}:${point.provider?.key || "unknown"}`;
        const colorIndex = seriesIndex.get(seriesKey) % 3;
        const x =
          chart.left +
          (days.length <= 1
            ? plotWidth / 2
            : (dayIndex / (days.length - 1)) * plotWidth) +
          userOffsets[colorIndex];
        const y =
          chart.top + plotHeight - (point.count / maximum) * plotHeight;

        return {
          ...point,
          colorIndex,
          id: `${point.date}:${seriesKey}`,
          seriesKey,
          x,
          y
        };
      })
    );
    const ticks = [...new Set([0, Math.ceil(maximum / 2), maximum])].sort(
      (left, right) => left - right
    );

    const lines = series.map((entry, index) => ({
      colorIndex: index % 3,
      key: entry.key,
      points: points.filter((point) => point.seriesKey === entry.key)
    }));

    return { days, lines, maximum, plotHeight, points, series, ticks };
  }, [dailyUploads]);
  const activePoint = model.points.find((point) => point.id === activeId);
  const tooltipWidth = 225;
  const tooltipHeight = 158;
  const tooltipX = activePoint
    ? Math.min(
        chart.width - chart.right - tooltipWidth,
        Math.max(chart.left, activePoint.x + 12)
      )
    : 0;
  const tooltipY = activePoint
    ? activePoint.y + tooltipHeight + 10 > chart.height - 4
      ? Math.max(4, activePoint.y - tooltipHeight - 10)
      : activePoint.y + 10
    : 0;

  return (
    <article className="activity-card-panel activity-chart-card">
      <header className="activity-card-heading">
        <div>
          <span className="eyebrow">14-day activity</span>
          <h2>Uploads per day</h2>
          <p>Lines connect each user and provider’s successful uploads by day.</p>
        </div>
        <div className="activity-user-legend" aria-label="Chart users">
          {model.series.map((entry, index) => (
            <span key={entry.key}>
              <i className={`activity-user-${index % 3}`} />
              {entry.label}
            </span>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="activity-panel-loading" role="status">
          <span className="loading-spinner" />
          Loading upload activity…
        </div>
      ) : model.points.length === 0 ? (
        <div className="activity-empty">
          <strong>No uploads recorded yet</strong>
          <span>New successful uploads will appear here.</span>
        </div>
      ) : (
        <div className="activity-chart-scroll">
          <div className="activity-chart-stage">
            <svg
              aria-label="Successful uploads per user and provider per day"
              className="activity-scatter-chart"
              onMouseLeave={() => setActiveId(undefined)}
              role="group"
              viewBox={`0 0 ${chart.width} ${chart.height}`}
            >
              {model.ticks.map((tick) => {
                const y =
                  chart.top +
                  model.plotHeight -
                  (tick / model.maximum) * model.plotHeight;
                return (
                  <g className="activity-grid-line" key={tick}>
                    <line
                      x1={chart.left}
                      x2={chart.width - chart.right}
                      y1={y}
                      y2={y}
                    />
                    <text x={chart.left - 10} y={y + 3}>
                      {tick}
                    </text>
                  </g>
                );
              })}

              {model.days.map((day, index) => {
                const plotWidth = chart.width - chart.left - chart.right;
                const x =
                  chart.left +
                  (model.days.length <= 1
                    ? plotWidth / 2
                    : (index / (model.days.length - 1)) * plotWidth);
                return (
                  <text
                    className="activity-day-label"
                    key={day.date}
                    textAnchor="middle"
                    x={x}
                    y={chart.height - 16}
                  >
                    {formatDay(day.date)}
                  </text>
                );
              })}

              {model.lines.map((line) =>
                line.points.length > 1 ? (
                  <polyline
                    className={`activity-series-line activity-user-${line.colorIndex}`}
                    key={line.key}
                    points={line.points
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                  />
                ) : null
              )}

              {model.points.map((point) => (
                <circle
                  aria-label={`${point.user.displayName}: ${point.count} uploads on ${formatDay(point.date)}`}
                  className={`activity-dot activity-user-${point.colorIndex}`}
                  cx={point.x}
                  cy={point.y}
                  key={point.id}
                  onClick={() => setActiveId(point.id)}
                  onBlur={() => setActiveId(undefined)}
                  onFocus={() => setActiveId(point.id)}
                  onMouseEnter={() => setActiveId(point.id)}
                  r="6"
                  role="button"
                  tabIndex="0"
                >
                  <title>
                    {point.user.displayName}: {point.count} uploads, {formatBytes(point.totalBytes)}
                  </title>
                </circle>
              ))}

              {activePoint && (
                <foreignObject
                  className="activity-chart-tooltip-frame"
                  height={tooltipHeight}
                  role="status"
                  width={tooltipWidth}
                  x={tooltipX}
                  y={tooltipY}
                >
                  <div className="activity-chart-tooltip">
                    <strong>
                      {activePoint.user.displayName} · {activePoint.count}{" "}
                      upload{activePoint.count === 1 ? "" : "s"}
                    </strong>
                    <span>
                      {formatDay(activePoint.date)} ·{" "}
                      {formatBytes(activePoint.totalBytes)}
                    </span>
                    <ul>
                      {activePoint.uploads.slice(0, 4).map((upload) => (
                        <li key={upload.id}>
                          <b>{upload.file.name}</b>
                          <small>
                            {upload.provider.displayName} ·{" "}
                            {formatBytes(upload.file.size)} ·{" "}
                            {formatTime(upload.occurredAt)}
                          </small>
                        </li>
                      ))}
                    </ul>
                    {activePoint.uploads.length > 4 && (
                      <em>+{activePoint.uploads.length - 4} more</em>
                    )}
                  </div>
                </foreignObject>
              )}
            </svg>
          </div>
        </div>
      )}
    </article>
  );
}
