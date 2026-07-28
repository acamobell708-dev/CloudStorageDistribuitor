const { ValidationError } = require("../errors/ApplicationError");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

class StorageController {
  constructor({
    fileDownloadService,
    fileListingService,
    fileUploadService,
    providerFactory
  }) {
    this.fileDownloadService = fileDownloadService;
    this.fileListingService = fileListingService;
    this.fileUploadService = fileUploadService;
    this.providerFactory = providerFactory;
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
        await this.fileListingService.list(request.params.provider)
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
      if (!request.file) {
        throw new ValidationError(
          'Choose a file and submit it using the "file" form field'
        );
      }

      const result = await this.fileUploadService.upload(
        request.params.provider,
        request.file
      );

      response.status(result.file.duplicate ? 200 : 201).json(result);
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
