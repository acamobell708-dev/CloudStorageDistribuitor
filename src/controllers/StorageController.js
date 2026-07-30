const { ValidationError } = require("../errors/ApplicationError");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const {
  UploadPathService
} = require("../services/storage/UploadPathService");

class StorageController {
  constructor({
    fileDeletionService,
    fileDownloadService,
    fileListingService,
    fileUploadService,
    permanentFileDeletionService,
    providerFactory
  }) {
    this.fileDeletionService = fileDeletionService;
    this.fileDownloadService = fileDownloadService;
    this.fileListingService = fileListingService;
    this.fileUploadService = fileUploadService;
    this.permanentFileDeletionService = permanentFileDeletionService;
    this.providerFactory = providerFactory;
    this.uploadPathService = new UploadPathService();
  }

  listProviders = async (request, response, next) => {
    try {
      response.json({
        providers: await this.providerFactory.list()
      });
    } catch (error) {
      next(error);
    }
  };

  listFiles = async (request, response, next) => {
    try {
      response.json(
        await this.fileListingService.list(request.params.provider, {
          browse: request.query.browse === "true",
          folderId: request.query.folderId,
          path: request.query.path
        })
      );
    } catch (error) {
      next(error);
    }
  };

  deleteFile = async (request, response, next) => {
    try {
      response.json(
        await this.fileDeletionService.delete(
          request.params.provider,
          {
            id: request.params.fileId,
            path: request.query.path,
            type: request.query.type
          }
        )
      );
    } catch (error) {
      next(error);
    }
  };

  permanentlyDeleteFile = async (request, response, next) => {
    try {
      response.json(
        await this.permanentFileDeletionService.delete(
          request.params.provider,
          {
            id: request.params.fileId,
            path: request.query.path
          }
        )
      );
    } catch (error) {
      next(error);
    }
  };

  downloadFile = async (request, response, next) => {
    try {
      const download = await this.fileDownloadService.getDownload(
        request.params.provider,
        {
          id: request.params.fileId,
          path: request.query.path
        }
      );
      const body = this.createDownloadStream(download.body);

      response.attachment(download.filename);
      response.set("Cache-Control", "private, no-store");

      if (download.contentType) {
        response.type(download.contentType);
      }

      if (Number.isFinite(download.size) && download.size >= 0) {
        response.set("Content-Length", String(download.size));
      }

      await pipeline(body, response);
    } catch (error) {
      next(error);
    }
  };

  uploadFile = async (request, response, next) => {
    try {
      const files = [
        ...(request.files?.file || []),
        ...(request.files?.files || [])
      ];

      if (files.length === 0) {
        throw new ValidationError(
          'Choose one or more files and submit them using the "file" or "files" form field'
        );
      }

      const manifest = this.uploadPathService.applyManifest(
        files,
        request.body?.manifest
      );
      const result = await this.fileUploadService.uploadMany(
        request.params.provider,
        files,
        manifest
      );

      response
        .status(
          result.duplicateCount === result.files.length ? 200 : 201
        )
        .json(result);
    } catch (error) {
      next(error);
    }
  };

  createDownloadStream(body) {
    if (typeof body?.pipe === "function") {
      return body;
    }

    if (typeof body?.getReader === "function") {
      return Readable.fromWeb(body);
    }

    if (Buffer.isBuffer(body) || typeof body === "string") {
      return Readable.from([body]);
    }

    throw new TypeError("The cloud provider returned an invalid file stream");
  }
}

module.exports = { StorageController };
