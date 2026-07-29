const assert = require("node:assert/strict");
const test = require("node:test");
const {
  LoginAttemptService
} = require("../../src/services/auth/LoginAttemptService");

test("temporarily limits repeated failed login attempts", () => {
  let now = 1000;
  const service = new LoginAttemptService({
    clock: {
      now: () => now
    },
    maximumAttempts: 2,
    windowMs: 500
  });

  service.recordFailure("client");
  service.assertAllowed("client");
  service.recordFailure("client");
  assert.throws(
    () => service.assertAllowed("client"),
    (error) =>
      error.code === "TOO_MANY_ATTEMPTS" &&
      error.statusCode === 429
  );

  now = 1600;
  assert.doesNotThrow(() => service.assertAllowed("client"));

  service.recordFailure("client");
  service.clear("client");
  assert.doesNotThrow(() => service.assertAllowed("client"));
});
