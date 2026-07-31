const activityActions = Object.freeze([
  "delete",
  "download",
  "upload"
]);

function clampInteger(value, fallback, minimum, maximum) {
  const number = Number(value);

  if (!Number.isInteger(number)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, number));
}

function normalizeText(value, fallback, maximumLength = 256) {
  const text = String(value || "").trim();
  return (text || fallback).slice(0, maximumLength);
}

function normalizeTimestamp(value, fallback) {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime())
    ? new Date(fallback).toISOString()
    : date.toISOString();
}

function toDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

class ActivityLogService {
  constructor(options = {}) {
    this.clock = options.clock || Date;
    this.maxEvents = clampInteger(
      options.maxEvents,
      500,
      10,
      5000
    );
    this.events = [];
    this.sequence = 0;

    for (const event of [...(options.initialEvents || [])].reverse()) {
      this.record(event);
    }
  }

  record(event = {}) {
    if (!activityActions.includes(event.action)) {
      throw new TypeError("A supported activity action is required");
    }

    const occurredAt = normalizeTimestamp(
      event.occurredAt,
      this.clock.now()
    );
    const normalizedEvent = {
      action: event.action,
      file: {
        id: normalizeText(event.file?.id, "", 256),
        name: normalizeText(
          event.file?.name ||
            event.file?.filename ||
            event.file?.originalName,
          "Item"
        ),
        path: normalizeText(event.file?.path, "", 1024),
        size: Number.isFinite(Number(event.file?.size))
          ? Math.max(0, Number(event.file.size))
          : undefined,
        type: event.file?.type === "folder" ? "folder" : "file"
      },
      id: `activity-${occurredAt}-${++this.sequence}`,
      itemCount: clampInteger(event.itemCount, 1, 1, 10000),
      occurredAt,
      permanent: Boolean(event.permanent),
      provider: {
        displayName: normalizeText(
          event.provider?.displayName,
          "Cloud storage",
          80
        ),
        key: normalizeText(event.provider?.key, "unknown", 40)
      },
      user: {
        displayName: normalizeText(
          event.user?.displayName || event.user?.username,
          "Unknown user",
          80
        ),
        id: normalizeText(event.user?.id, "unknown", 80)
      }
    };

    this.events.unshift(normalizedEvent);
    this.events.length = Math.min(this.events.length, this.maxEvents);
    return normalizedEvent;
  }

  list(options = {}) {
    const pageSize = clampInteger(options.pageSize, 10, 1, 10);
    const requestedPage = clampInteger(
      options.page,
      1,
      1,
      Number.MAX_SAFE_INTEGER
    );
    const days = clampInteger(options.days, 14, 7, 31);
    const totalItems = this.events.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * pageSize;

    return {
      dailyUploads: this.createDailyUploads(days),
      history: {
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        items: this.events.slice(start, start + pageSize),
        page,
        pageSize,
        totalItems,
        totalPages
      }
    };
  }

  createDailyUploads(days) {
    const end = new Date(this.clock.now());
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);
    const dayMap = new Map();

    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + dayIndex);
      const key = toDateKey(date);
      dayMap.set(key, new Map());
    }

    for (const event of this.events) {
      if (event.action !== "upload") {
        continue;
      }

      const date = toDateKey(event.occurredAt);
      const userMap = dayMap.get(date);

      if (!userMap) {
        continue;
      }

      const point = userMap.get(event.user.id) || {
        count: 0,
        date,
        totalBytes: 0,
        uploads: [],
        user: event.user
      };

      point.count += event.itemCount;
      point.totalBytes += event.file.size || 0;
      point.uploads.push({
        file: event.file,
        id: event.id,
        occurredAt: event.occurredAt,
        provider: event.provider
      });
      userMap.set(event.user.id, point);
    }

    return {
      days: [...dayMap].map(([date, userMap]) => ({
        date,
        points: [...userMap.values()].sort((left, right) =>
          left.user.displayName.localeCompare(right.user.displayName)
        )
      })),
      endDate: toDateKey(end),
      startDate: toDateKey(start)
    };
  }
}

module.exports = {
  activityActions,
  ActivityLogService
};
