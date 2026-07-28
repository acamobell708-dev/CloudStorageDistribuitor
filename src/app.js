const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { environment: defaultEnvironment } = require("./config/environment");
const { StorageController } = require("./controllers/StorageController");
const {
  errorHandler,
  notFoundHandler
} = require("./middleware/errorHandler");
const { createStorageRoutes } = require("./routes/storageRoutes");
const { FileDownloadService } = require("./services/FileDownloadService");
const { FileListingService } = require("./services/FileListingService");
const { FileUploadService } = require("./services/FileUploadService");
const {
  createStorageProviderFactory
} = require("./services/storage/StorageProviderFactory");

function setSecurityHeaders(request, response, next) {
  response.set({
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' blob: data:; " +
      "style-src 'self'; script-src 'self'; connect-src 'self'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  next();
}

function createApp(options = {}) {
  const config = options.environment || defaultEnvironment;
  const providerFactory =
    options.providerFactory || createStorageProviderFactory(config);
  const fileUploadService =
    options.fileUploadService || new FileUploadService(providerFactory);
  const fileListingService =
    options.fileListingService || new FileListingService(providerFactory);
  const fileDownloadService =
    options.fileDownloadService ||
    new FileDownloadService(providerFactory);
  const controller = new StorageController({
    fileDownloadService,
    fileListingService,
    fileUploadService,
    providerFactory
  });
  const app = express();

  app.disable("x-powered-by");
  app.use(setSecurityHeaders);

  app.get("/api/health", (request, response) => {
    response.json({
      service: "cloud-storage-distributor",
      status: "ok"
    });
  });
  app.use(
    "/api/storage",
    createStorageRoutes({
      controller,
      providerFactory,
      uploadTempDirectory: config.uploadTempDirectory
    })
  );
  app.use("/api", notFoundHandler);

  const clientBuildDirectory = path.join(config.projectRoot, "dist");

  if (fs.existsSync(clientBuildDirectory)) {
    app.use(
      express.static(clientBuildDirectory, {
        fallthrough: true,
        index: false,
        maxAge: "1h"
      })
    );
    app.use((request, response, next) => {
      if (request.method !== "GET" || !request.accepts("html")) {
        next();
        return;
      }

      response.sendFile(path.join(clientBuildDirectory, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
