class ApplicationError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = this.constructor.name;
    this.code = options.code || "APPLICATION_ERROR";
    this.details = options.details;
    this.statusCode = options.statusCode || 500;
  }
}

class ValidationError extends ApplicationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || "VALIDATION_ERROR",
      statusCode: options.statusCode || 400
    });
  }
}

class ConfigurationError extends ApplicationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || "CONFIGURATION_ERROR",
      statusCode: options.statusCode || 503
    });
  }
}

class ExternalServiceError extends ApplicationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || "EXTERNAL_SERVICE_ERROR",
      statusCode: options.statusCode || 502
    });
  }
}

module.exports = {
  ApplicationError,
  ConfigurationError,
  ExternalServiceError,
  ValidationError
};
