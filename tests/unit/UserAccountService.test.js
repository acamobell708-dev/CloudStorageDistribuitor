const assert = require("node:assert/strict");
const { scryptSync } = require("node:crypto");
const test = require("node:test");
const {
  predefinedAccounts,
  UserAccountService
} = require("../../src/services/auth/UserAccountService");

function createTestService() {
  const salt = Buffer.from("unit-test-salt");
  const passwordHash = scryptSync(
    "correct-test-password",
    salt,
    64
  ).toString("hex");

  return new UserAccountService([
    {
      displayName: "Test Owner",
      id: "test-owner",
      passwordHash,
      permissions: ["storage:purge"],
      role: "owner",
      salt: salt.toString("hex"),
      username: "TestOwner"
    }
  ]);
}

test("authenticates a predefined-style account without exposing its hash", async () => {
  const service = createTestService();
  const user = await service.authenticate(
    "testowner",
    "correct-test-password"
  );

  assert.equal(user.displayName, "Test Owner");
  assert.equal(user.role, "owner");
  assert.deepEqual(user.permissions, ["storage:purge"]);
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.salt, undefined);
});

test("returns a generic error for incorrect login details", async () => {
  const service = createTestService();

  await assert.rejects(
    service.authenticate("TestOwner", "incorrect"),
    (error) =>
      error.code === "INVALID_LOGIN" &&
      error.statusCode === 401 &&
      /username or password/.test(error.message)
  );
  await assert.rejects(
    service.authenticate("MissingUser", "incorrect"),
    (error) => error.code === "INVALID_LOGIN"
  );
});

test("defines one owner, two members, and a read-only guest", () => {
  const service = new UserAccountService();
  const roles = predefinedAccounts.map((account) => account.role);
  const guest = service.createGuest();

  assert.deepEqual(roles, ["member", "owner", "member"]);
  assert.equal(guest.role, "guest");
  assert.deepEqual(guest.permissions.sort(), [
    "page:dashboard",
    "page:home"
  ]);
});
