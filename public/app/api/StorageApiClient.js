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

  async listProviders(options = {}) {
    const response = await fetch(`${this.baseUrl}/storage/providers`, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      },
      signal: options.signal
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

  getFileUrl(provider, file) {
    const providerKey = encodeURIComponent(provider);
    const fileId = encodeURIComponent(file?.id || "");
    const query = new URLSearchParams();

    if (file?.path) {
      query.set("path", file.path);
    }

    const queryString = query.toString();

    return (
      `${this.baseUrl}/storage/${providerKey}/files/${fileId}` +
      (queryString ? `?${queryString}` : "")
    );
  }

  getFileDownloadUrl(provider, file) {
    const fileUrl = this.getFileUrl(provider, file);
    return this.appendFileUrlSegment(fileUrl, "download");
  }

  appendFileUrlSegment(fileUrl, segment) {
    const queryIndex = fileUrl.indexOf("?");

    if (queryIndex === -1) {
      return `${fileUrl}/${segment}`;
    }

    return (
      `${fileUrl.slice(0, queryIndex)}/${segment}` +
      fileUrl.slice(queryIndex)
    );
  }

  async deleteFile(provider, file) {
    const response = await fetch(this.getFileUrl(provider, file), {
      headers: {
        Accept: "application/json"
      },
      method: "DELETE"
    });
    const body = await this.readJson(response);

    if (!response.ok) {
      throw this.createError(response, body);
    }

    return body;
  }

  async permanentlyDeleteFile(provider, file) {
    const fileUrl = this.getFileUrl(provider, file);
    const response = await fetch(
      this.appendFileUrlSegment(fileUrl, "history"),
      {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        },
        method: "DELETE"
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
