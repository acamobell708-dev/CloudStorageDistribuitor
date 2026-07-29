const { randomBytes } = require("node:crypto");

class SessionService {
  constructor(options = {}) {
    this.clock = options.clock || Date;
    this.durationMs = options.durationMs || 8 * 60 * 60 * 1000;
    this.sessions = new Map();
  }

  create(user) {
    this.prune();

    const token = randomBytes(32).toString("hex");
    const expiresAt = this.clock.now() + this.durationMs;

    this.sessions.set(token, {
      expiresAt,
      user
    });

    return {
      expiresAt,
      token
    };
  }

  get(token) {
    if (!token) {
      return undefined;
    }

    const session = this.sessions.get(token);

    if (!session) {
      return undefined;
    }

    if (session.expiresAt <= this.clock.now()) {
      this.sessions.delete(token);
      return undefined;
    }

    return session;
  }

  revoke(token) {
    if (token) {
      this.sessions.delete(token);
    }
  }

  prune() {
    const now = this.clock.now();

    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }
}

module.exports = { SessionService };
