const { ExternalServiceError } = require("../../../errors/ApplicationError");

class BoxApiClient {
  constructor(options = {}) {
    this.authClient = options.authClient;
    this.fetch = options.fetch || globalThis.fetch;
    this.apiUrl = options.apiUrl || "https://api.box.com/2.0";
    this.uploadUrl =
      options.uploadUrl || "https://upload.box.com/api/2.0";
  }

  async request(url, options = {}) {
    const accessToken = await this.authClient.getAccessToken();
    const { action, ...fetchOptions } = options;
    let response;

    try {
      response = await this.fetch(url, {
        ...fetchOptions,
        headers: {
          ...(fetchOptions.headers || {}),
          Authorization: `Bearer ${accessToken}`
        }
      });
    } catch (error) {
      throw new ExternalServiceError(
        `${action || "Box request"} could not reach Box`,
        { cause: error }
      );
    }

    if (!response.ok) {
      const body = await this.readResponseBody(response);
      const message = this.getErrorMessage(body);

      if (response.status === 401) {
        this.authClient.invalidateToken();
      }

      throw new ExternalServiceError(
        `${action || "Box request"} failed with Box status ` +
          `${response.status}: ${message}`,
        {
          details: {
            boxCode: typeof body === "object" ? body?.code : undefined,
            boxStatus: response.status
          }
        }
      );
    }

    return response;
  }

  async requestJson(url, options = {}) {
    const response = await this.request(url, options);
    return this.readResponseBody(response);
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
      body.context_info?.message ||
      body.message ||
      body.code ||
      "Unknown Box error"
    );
  }
}

module.exports = { BoxApiClient };
