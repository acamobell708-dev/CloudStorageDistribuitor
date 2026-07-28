const express = require("express");
const multer = require("multer");
const os = require("node:os");
const path = require("node:path");

function createProviderUploadMiddleware({
  providerFactory,
  uploadTempDirectory
}) {
  return async (request, response, next) => {
    try {
      const provider = providerFactory.get(request.params.provider);
      const maximumUploadSizeBytes =
        await provider.getMaximumUploadSizeBytes();
      const uploadOptions = {
        limits: {
          fileSize: maximumUploadSizeBytes,
          files: 1,
          fields: 0,
          parts: 2
        }
      };

      if (provider.browserUploadStorage === "memory") {
        uploadOptions.storage = multer.memoryStorage();
      } else {
        uploadOptions.dest =
          uploadTempDirectory ||
          path.join(os.tmpdir(), "cloud-storage-distributor");
      }

      const upload = multer(uploadOptions).single("file");

      upload(request, response, (error) => {
        if (request.file) {
          request.file.temporary = Boolean(request.file.path);
        }

        next(error);
      });
    } catch (error) {
      next(error);
    }
  };
}

function createStorageRoutes({
  controller,
  providerFactory,
  uploadTempDirectory
}) {
  const router = express.Router();
  const uploadFile = createProviderUploadMiddleware({
    providerFactory,
    uploadTempDirectory
  });

  router.get("/providers", controller.listProviders);
  router.get("/:provider/files", controller.listFiles);
  router.get(
    "/:provider/files/:fileId/download",
    controller.downloadFile
  );
  router.post(
    "/:provider/files",
    uploadFile,
    controller.uploadFile
  );

  return router;
}

module.exports = {
  createProviderUploadMiddleware,
  createStorageRoutes
};
