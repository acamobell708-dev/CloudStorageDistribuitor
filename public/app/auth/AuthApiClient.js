export class AuthApiClient {
  constructor(baseUrl = "/api/auth") {
    this.baseUrl = baseUrl;
  }

  async getSession() {
    return this.request("/session", {
      cache: "no-store",
      method: "GET"
    });
  }

  async login({ password, username }) {
    return this.request("/login", {
      body: JSON.stringify({
        password,
        username
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  }

  async loginAsGuest() {
    return this.request("/guest", {
      method: "POST"
    });
  }

  async logout() {
    return this.request("/logout", {
      method: "POST"
    });
  }

  async request(path, options) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let body = {};

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }

    if (!response.ok) {
      const error = new Error(
        body?.error?.message ||
          `Authentication request failed with status ${response.status}`
      );

      error.code = body?.error?.code;
      error.status = response.status;
      throw error;
    }

    return body;
  }
}
