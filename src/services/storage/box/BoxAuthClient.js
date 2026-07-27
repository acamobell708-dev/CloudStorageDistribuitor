const {
  ConfigurationError,
  ExternalServiceError
} = require("../../../errors/ApplicationError");

class BoxAuthClient {
  constructor(options = {}) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.enterpriseId = options.enterpriseId;
    this.fetch = options.fetch || globalThis.fetch;
    this.tokenUrl = options.tokenUrl || "https://api.box.com/oauth2/token";
    this.cachedAccessToken = undefined;
    this.cachedAccessTokenExpiresAt = 0;
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.enterpriseId);
  }

  requireConfiguration() {
    const missing = [];

    if (!this.clientId) {
      missing.push("BOX_CLIENT_ID");
    }

    if (!this.clientSecret) {
      missing.push("BOX_CLIENT_SECRET");
    }

    if (!this.enterpriseId) {
      missing.push("BOX_ENTERPRISE_ID");
    }

    if (missing.length > 0) {
      throw new ConfigurationError(
        `Missing Box configuration: ${missing.join(", ")}`
      );
    }
  }

  invalidateToken() {
    this.cachedAccessToken = undefined;
    this.cachedAccessTokenExpiresAt = 0;
  }

  async getAccessToken() {
    this.requireConfiguration();

    if (
      this.cachedAccessToken &&
      Date.now() < this.cachedAccessTokenExpiresAt
    ) {
      return this.cachedAccessToken;
    }

    const body = new URLSearchParams({
      box_subject_id: this.enterpriseId,
      box_subject_type: "enterprise",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials"
    });

    let response;

    try {
      response = await this.fetch(this.tokenUrl, {
        body,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      });
    } catch (error) {
      throw new ExternalServiceError(
        "Box authentication could not be reached",
        { cause: error }
      );
    }

    const responseBody = await this.readResponseBody(response);

    if (!response.ok) {
      throw new ExternalServiceError(
        `Box authentication failed with status ${response.status}: ` +
          this.getErrorMessage(responseBody),
        { details: { boxStatus: response.status } }
      );
    }

    if (!responseBody?.access_token) {
      throw new ExternalServiceError("Box did not return an access token");
    }

    const expiresInSeconds = Number(responseBody.expires_in || 3600);

    this.cachedAccessToken = responseBody.access_token;
    this.cachedAccessTokenExpiresAt =
      Date.now() + Math.max(expiresInSeconds - 60, 1) * 1000;

    return this.cachedAccessToken;
  }

  async readResponseBody(response) {
    const text = await response.text();

    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  getErrorMessage(body) {
    if (!body) {
      return "No response body was returned";
    }

    if (typeof body === "string") {
      return body;
    }

    return (
      body.error_description ||
      body.message ||
      body.code ||
      "Unknown Box error"
    );
  }
}

module.exports = { BoxAuthClient };
