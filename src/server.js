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

if (require.main === module) {
  startServer()
    .then((server) => {
      const address = server.address();
      console.log(
        `Cloud Storage Distributor listening at ` +
          `http://${address.address}:${address.port}`
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { startServer };
