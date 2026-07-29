const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SessionService
} = require("../../src/services/auth/SessionService");

test("creates, expires, and revokes in-memory sessions", () => {
  let now = 1000;
  const service = new SessionService({
    clock: {
      now: () => now
    },
    durationMs: 500
  });
  const user = {
    id: "test-user"
  };
  const session = service.create(user);

  assert.equal(session.token.length, 64);
  assert.equal(service.get(session.token).user, user);

  now = 1600;
  assert.equal(service.get(session.token), undefined);

  const replacement = service.create(user);
  service.revoke(replacement.token);
  assert.equal(service.get(replacement.token), undefined);
});
