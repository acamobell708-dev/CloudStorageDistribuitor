const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ActivityController
} = require("../../src/controllers/ActivityController");
const {
  ActivityLogService
} = require("../../src/services/ActivityLogService");

test("returns safe provider diagnostics when cold-start history retrieval fails", async () => {
  const controller = new ActivityController({
    activityLogService: new ActivityLogService(),
    providerFactory: {
      get: (providerKey) => {
        if (providerKey === "box") {
          return {
            listActivityEvents: async () => {
              const error = new Error("Box secret must remain private");
              error.code = "EXTERNAL_SERVICE_ERROR";
              error.details = { boxStatus: 403 };
              throw error;
            }
          };
        }

        return { listActivityEvents: async () => [] };
      }
    }
  });
  let payload;
  const response = {
    json: (value) => {
      payload = value;
    },
    set: () => undefined
  };

  await controller.list({ query: {} }, response, (error) => {
    throw error;
  });

  assert.deepEqual(payload.fallbackWarnings, [
    {
      code: "EXTERNAL_SERVICE_ERROR",
      provider: "Box",
      status: 403
    }
  ]);
  assert.equal(JSON.stringify(payload).includes("secret"), false);
});
