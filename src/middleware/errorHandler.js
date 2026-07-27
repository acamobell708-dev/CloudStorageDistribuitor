const multer = require("multer");
const { ApplicationError } = require("../errors/ApplicationError");

function notFoundHandler(request, response) {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested API endpoint was not found"
    }
  });
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    const fileTooLarge = error.code === "LIMIT_FILE_SIZE";

    response.status(fileTooLarge ? 413 : 400).json({
      error: {
        code: fileTooLarge ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
        message: fileTooLarge
          ? "The selected file is larger than the server upload limit"
          : error.message
      }
    });
    return;
  }

  if (error instanceof ApplicationError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
        message: error.message
      }
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "The upload could not be completed"
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
