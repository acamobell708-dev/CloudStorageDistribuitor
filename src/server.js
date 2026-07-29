const { createApp } = require("./app");
const { environment } = require("./config/environment");

function startServer(options = {}) {
  const app = options.app || createApp();
  const host = options.host || environment.host;
  const port = options.port ?? environment.port;

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);

    server.once("error", reject);
    server.once("listening", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

function stopServer(server, options = {}) {
  const timeoutMs = options.timeoutMs || 10_000;

  return new Promise((resolve, reject) => {
    const forceCloseTimer = setTimeout(() => {
      server.closeAllConnections?.();
    }, timeoutMs);

    forceCloseTimer.unref();
    server.close((error) => {
      clearTimeout(forceCloseTimer);

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
    server.closeIdleConnections?.();
  });
}

if (require.main === module) {
  startServer()
    .then((server) => {
      const address = server.address();
      console.log(
        `Cloud Storage Distributor listening at ` +
          `http://${address.address}:${address.port}`
      );

      let shutdownPromise;

      for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => {
          if (!shutdownPromise) {
            console.log(
              `${signal} received; finishing active requests before shutdown`
            );
            shutdownPromise = stopServer(server).catch((error) => {
              console.error(error);
              process.exitCode = 1;
            });
          }
        });
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  startServer,
  stopServer
};
