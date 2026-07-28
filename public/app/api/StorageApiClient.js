export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
  }
}

export class StorageApiClient {
  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  async listProviders() {
    const response = await fetch(`${this.baseUrl}/storage/providers`, {
      headers: {
        Accept: "application/json"
      }
    });
    const body = await this.readJson(response);

    if (!response.ok) {
      throw this.createError(response, body);
    }

    return body.providers || [];
  }

  async listFiles(provider, options = {}) {
    const response = await fetch(
      `${this.baseUrl}/storage/` +
        `${encodeURIComponent(provider)}/files`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        },
        signal: options.signal
      }
    );
    const body = await this.readJson(response);

    if (!response.ok) {
      throw this.createError(response, body);
    }

    return body;
  }

  uploadFile({ file, onProgress, provider = "box" }) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const form = new FormData();

      form.append("file", file, file.name);
      request.open(
        "POST",
        `${this.baseUrl}/storage/${encodeURIComponent(provider)}/files`
      );
      request.setRequestHeader("Accept", "application/json");

      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress?.(Math.round((event.loaded / event.total) * 92));
        }
      });

      request.addEventListener("load", () => {
        const body = this.parseText(request.responseText);

        if (request.status >= 200 && request.status < 300) {
          onProgress?.(100);
          resolve(body);
          return;
        }

        reject(
          new ApiError(
            body?.error?.message ||
              `Upload failed with status ${request.status}`,
            {
              code: body?.error?.code,
              status: request.status
            }
          )
        );
      });

      request.addEventListener("error", () => {
        reject(
          new ApiError("The upload service could not be reached", {
            code: "NETWORK_ERROR"
          })
        );
      });

      request.send(form);
    });
  }

  async readJson(response) {
    const text = await response.text();
    return this.parseText(text);
  }

  parseText(text) {
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  createError(response, body) {
    return new ApiError(
      body?.error?.message || `Request failed with status ${response.status}`,
      {
        code: body?.error?.code,
        status: response.status
      }
    );
  }
}
