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

class AuthorizationError extends ApplicationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || "AUTHORIZATION_ERROR",
      statusCode: options.statusCode || 403
    });
  }
}

class AuthenticationError extends ApplicationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || "AUTHENTICATION_REQUIRED",
      statusCode: options.statusCode || 401
    });
  }
}

class RateLimitError extends ApplicationError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || "TOO_MANY_ATTEMPTS",
      statusCode: options.statusCode || 429
    });
  }
}

module.exports = {
  ApplicationError,
  AuthenticationError,
  AuthorizationError,
  ConfigurationError,
  ExternalServiceError,
  RateLimitError,
  ValidationError
};
