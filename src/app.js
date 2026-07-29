const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { environment: defaultEnvironment } = require("./config/environment");
const { AuthController } = require("./controllers/AuthController");
const { StorageController } = require("./controllers/StorageController");
const {
  createAuthenticationMiddleware,
  createPageAccessMiddleware,
  requireAuthentication,
  requirePermission
} = require("./middleware/authentication");
const {
  errorHandler,
  notFoundHandler
} = require("./middleware/errorHandler");
const { createAuthRoutes } = require("./routes/authRoutes");
const { createStorageRoutes } = require("./routes/storageRoutes");
const { FileDeletionService } = require("./services/FileDeletionService");
const { FileDownloadService } = require("./services/FileDownloadService");
const { FileListingService } = require("./services/FileListingService");
const { FileUploadService } = require("./services/FileUploadService");
const {
  PermanentFileDeletionService
} = require("./services/PermanentFileDeletionService");
const {
  createStorageProviderFactory
} = require("./services/storage/StorageProviderFactory");
const {
  LoginAttemptService
} = require("./services/auth/LoginAttemptService");
const {
  SessionService
} = require("./services/auth/SessionService");
const {
  UserAccountService
} = require("./services/auth/UserAccountService");

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
  const userAccountService =
    options.userAccountService || new UserAccountService();
  const loginAttemptService =
    options.loginAttemptService || new LoginAttemptService();
  const sessionService =
    options.sessionService ||
    new SessionService({
      durationMs: config.auth?.sessionDurationMs
    });
  const fileUploadService =
    options.fileUploadService || new FileUploadService(providerFactory);
  const fileListingService =
    options.fileListingService || new FileListingService(providerFactory);
  const fileDownloadService =
    options.fileDownloadService ||
    new FileDownloadService(providerFactory);
  const fileDeletionService =
    options.fileDeletionService ||
    new FileDeletionService(providerFactory);
  const permanentFileDeletionService =
    options.permanentFileDeletionService ||
    new PermanentFileDeletionService(providerFactory);
  const authController = new AuthController({
    loginAttemptService,
    secureCookies: config.auth?.secureCookies,
    sessionService,
    userAccountService
  });
  const controller = new StorageController({
    fileDeletionService,
    fileDownloadService,
    fileListingService,
    fileUploadService,
    permanentFileDeletionService,
    providerFactory
  });
  const app = express();

  app.disable("x-powered-by");
  app.use(setSecurityHeaders);
  app.use(createAuthenticationMiddleware(sessionService));

  app.get("/api/health", (request, response) => {
    response.json({
      service: "cloud-storage-distributor",
      status: "ok"
    });
  });
  app.use(
    "/api/auth",
    createAuthRoutes({
      controller: authController
    })
  );
  app.use(
    "/api/storage",
    createStorageRoutes({
      controller,
      providerFactory,
      requireAuthentication,
      requirePermission,
      uploadTempDirectory: config.uploadTempDirectory
    })
  );
  app.use("/api", notFoundHandler);

  const clientBuildDirectory = path.join(config.projectRoot, "dist");

  if (fs.existsSync(clientBuildDirectory)) {
    app.use(createPageAccessMiddleware());
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

      if (!request.user) {
        response.redirect("/login.html");
        return;
      }

      response.sendFile(path.join(clientBuildDirectory, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
