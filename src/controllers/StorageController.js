const { ValidationError } = require("../errors/ApplicationError");

class StorageController {
  constructor({ fileListingService, fileUploadService, providerFactory }) {
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
}

module.exports = { StorageController };
