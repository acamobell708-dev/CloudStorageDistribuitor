const assert = require("node:assert/strict");
const test = require("node:test");
const { createApp } = require("../../src/app");
const {
  startServer,
  stopServer
} = require("../../src/server");

test("starts on an assigned port and shuts down cleanly", async () => {
  const app = createApp({
    environment: {
      auth: {
        secureCookies: false,
        sessionDurationMs: 60_000
      },
      azure: {},
      box: {},
      host: "127.0.0.1",
      port: 0,
      projectRoot: process.cwd()
    }
  });
  const server = await startServer({
    app,
    host: "127.0.0.1",
    port: 0
  });
  const address = server.address();

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/health`
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
  } finally {
    await stopServer(server);
  }

  assert.equal(server.listening, false);
});
