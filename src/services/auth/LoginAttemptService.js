const {
  RateLimitError
} = require("../../errors/ApplicationError");

class LoginAttemptService {
  constructor(options = {}) {
    this.attempts = new Map();
    this.clock = options.clock || Date;
    this.maximumAttempts = options.maximumAttempts || 5;
    this.windowMs = options.windowMs || 10 * 60 * 1000;
  }

  assertAllowed(key) {
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.expiresAt <= this.clock.now()) {
      this.attempts.delete(key);
      return;
    }

    if (attempt.count >= this.maximumAttempts) {
      throw new RateLimitError(
        "Too many unsuccessful login attempts. Try again later."
      );
    }
  }

  recordFailure(key) {
    const now = this.clock.now();
    const current = this.attempts.get(key);
    const attempt =
      current && current.expiresAt > now
        ? current
        : {
            count: 0,
            expiresAt: now + this.windowMs
          };

    attempt.count += 1;
    this.attempts.set(key, attempt);
  }

  clear(key) {
    this.attempts.delete(key);
  }
}

module.exports = { LoginAttemptService };
