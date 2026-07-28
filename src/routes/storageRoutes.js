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
      const upload = multer({
        dest:
          uploadTempDirectory ||
          path.join(os.tmpdir(), "cloud-storage-distributor"),
        limits: {
          fileSize: maximumUploadSizeBytes,
          files: 1,
          fields: 0,
          parts: 2
        }
      }).single("file");

      upload(request, response, (error) => {
        if (request.file) {
          request.file.temporary = true;
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
