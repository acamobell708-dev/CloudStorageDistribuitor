const express = require("express");
const multer = require("multer");

function createStorageRoutes({ controller, maximumUploadSizeBytes }) {
  const router = express.Router();
  const upload = multer({
    limits: {
      fileSize: maximumUploadSizeBytes,
      files: 1,
      fields: 0,
      parts: 2
    },
    storage: multer.memoryStorage()
  });

  router.get("/providers", controller.listProviders);
  router.post(
    "/:provider/files",
    upload.single("file"),
    controller.uploadFile
  );

  return router;
}

module.exports = { createStorageRoutes };
