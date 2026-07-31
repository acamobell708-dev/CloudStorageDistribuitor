const express = require("express");
const multer = require("multer");
const os = require("node:os");
const path = require("node:path");
const { permissions } = require("../services/auth/permissions");

const maximumBrowserUploadFiles = 250;

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
          files: maximumBrowserUploadFiles,
          fields: 1,
          parts: maximumBrowserUploadFiles + 1
        }
      };

      if (provider.browserUploadStorage === "memory") {
        uploadOptions.storage = multer.memoryStorage();
      } else {
        uploadOptions.dest =
          uploadTempDirectory ||
          path.join(os.tmpdir(), "cloud-storage-distributor");
      }

      const upload = multer(uploadOptions).fields([
        {
          maxCount: 1,
          name: "file"
        },
        {
          maxCount: maximumBrowserUploadFiles,
          name: "files"
        }
      ]);

      upload(request, response, (error) => {
        for (const files of Object.values(request.files || {})) {
          for (const file of files) {
            file.temporary = Boolean(file.path);
          }
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
  requireAuthentication,
  requirePermission,
  uploadTempDirectory
}) {
  const router = express.Router();
  const uploadFile = createProviderUploadMiddleware({
    providerFactory,
    uploadTempDirectory
  });

  router.use(requireAuthentication);
  router.get("/providers", controller.listProviders);
  router.get(
    "/:provider/files",
    requirePermission(permissions.listFiles),
    controller.listFiles
  );
  router.get(
    "/:provider/files/:fileId/download",
    requirePermission(permissions.downloadFiles),
    controller.downloadFile
  );
  router.get(
    "/:provider/files/:fileId/preview",
    requirePermission(permissions.downloadFiles),
    controller.previewFile
  );
  router.delete(
    "/:provider/files/:fileId/history",
    requirePermission(permissions.permanentlyDeleteFiles),
    controller.permanentlyDeleteFile
  );
  router.delete(
    "/:provider/files/:fileId",
    requirePermission(permissions.deleteFiles),
    controller.deleteFile
  );
  router.post(
    "/:provider/files",
    requirePermission(permissions.uploadFiles),
    uploadFile,
    controller.uploadFile
  );

  return router;
}

module.exports = {
  createStorageRoutes,
  maximumBrowserUploadFiles
};
