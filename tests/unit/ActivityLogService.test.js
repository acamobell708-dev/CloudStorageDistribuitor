const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ActivityLogService
} = require("../../src/services/ActivityLogService");

function createEvent(overrides = {}) {
  return {
    action: "upload",
    file: {
      id: overrides.fileId || "file-1",
      name: overrides.fileName || "example.txt",
      path: overrides.path || "/example.txt",
      size: overrides.size ?? 12
    },
    occurredAt: overrides.occurredAt || "2026-07-31T10:00:00Z",
    provider: {
      displayName: overrides.providerName || "Box",
      key: overrides.provider || "box"
    },
    user: {
      displayName: overrides.userName || "Adam",
      id: overrides.userId || "adam"
    },
    ...overrides.event
  };
}

test("aggregates uploads into one point per user and UTC day", () => {
  const service = new ActivityLogService({
    clock: { now: () => Date.parse("2026-07-31T18:00:00Z") }
  });

  service.record(createEvent());
  service.record(
    createEvent({
      fileId: "file-2",
      fileName: "photo.jpg",
      occurredAt: "2026-07-31T12:00:00Z",
      size: 30
    })
  );
  service.record(
    createEvent({
      fileId: "file-3",
      occurredAt: "2026-07-31T13:00:00Z",
      userId: "wilson",
      userName: "Wilson"
    })
  );
  service.record(
    createEvent({
      event: { action: "download" },
      occurredAt: "2026-07-31T14:00:00Z"
    })
  );

  const result = service.list({ days: 14 });
  const finalDay = result.dailyUploads.days.at(-1);

  assert.equal(result.dailyUploads.days.length, 14);
  assert.equal(finalDay.date, "2026-07-31");
  assert.equal(finalDay.points.length, 2);
  assert.deepEqual(
    finalDay.points.map((point) => ({
      count: point.count,
      totalBytes: point.totalBytes,
      user: point.user.displayName
    })),
    [
      { count: 2, totalBytes: 42, user: "Adam" },
      { count: 1, totalBytes: 12, user: "Wilson" }
    ]
  );
  assert.equal(finalDay.points[0].uploads.length, 2);
});

test("returns no more than ten newest history items per page", () => {
  const service = new ActivityLogService({
    clock: { now: () => Date.parse("2026-07-31T18:00:00Z") }
  });

  for (let index = 1; index <= 12; index += 1) {
    service.record(
      createEvent({
        event: { action: "download" },
        fileId: `file-${index}`,
        fileName: `file-${index}.txt`,
        occurredAt: `2026-07-31T10:${String(index).padStart(2, "0")}:00Z`
      })
    );
  }

  const firstPage = service.list({ page: 1, pageSize: 50 });
  const secondPage = service.list({ page: 2, pageSize: 10 });

  assert.equal(firstPage.history.pageSize, 10);
  assert.equal(firstPage.history.items.length, 10);
  assert.equal(firstPage.history.items[0].file.name, "file-12.txt");
  assert.equal(firstPage.history.hasNext, true);
  assert.deepEqual(
    secondPage.history.items.map((item) => item.file.name),
    ["file-2.txt", "file-1.txt"]
  );
  assert.equal(secondPage.history.hasPrevious, true);
  assert.equal(secondPage.history.hasNext, false);
});
