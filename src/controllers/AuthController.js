const {
  sessionCookieName
} = require("../middleware/authentication");

class AuthController {
  constructor({
    loginAttemptService,
    secureCookies = false,
    sessionService,
    userAccountService
  }) {
    this.loginAttemptService = loginAttemptService;
    this.secureCookies = secureCookies;
    this.sessionService = sessionService;
    this.userAccountService = userAccountService;
  }

  login = async (request, response, next) => {
    const attemptKey =
      request.ip || request.socket?.remoteAddress || "unknown";

    try {
      this.loginAttemptService.assertAllowed(attemptKey);
      const user = await this.userAccountService.authenticate(
        request.body?.username,
        request.body?.password
      );

      this.loginAttemptService.clear(attemptKey);
      this.startSession(request, response, user);
      response.json({
        authenticated: true,
        message: "Password accepted",
        user
      });
    } catch (error) {
      if (error.code === "INVALID_LOGIN") {
        this.loginAttemptService.recordFailure(attemptKey);
      }

      next(error);
    }
  };

  loginAsGuest = (request, response, next) => {
    try {
      const user = this.userAccountService.createGuest();

      this.startSession(request, response, user);
      response.json({
        authenticated: true,
        message: "Guest access granted",
        user
      });
    } catch (error) {
      next(error);
    }
  };

  getSession = (request, response) => {
    response.set("Cache-Control", "private, no-store");
    response.json({
      authenticated: Boolean(request.user),
      ...(request.user ? { user: request.user } : {})
    });
  };

  logout = (request, response) => {
    this.sessionService.revoke(request.sessionToken);
    response.clearCookie(sessionCookieName, this.getCookieOptions());
    response.set("Cache-Control", "private, no-store");
    response.json({
      authenticated: false,
      message: "Logged out"
    });
  };

  startSession(request, response, user) {
    this.sessionService.revoke(request.sessionToken);

    const session = this.sessionService.create(user);

    response.cookie(sessionCookieName, session.token, {
      ...this.getCookieOptions(),
      maxAge: this.sessionService.durationMs
    });
    response.set("Cache-Control", "private, no-store");
  }

  getCookieOptions() {
    return {
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: this.secureCookies
    };
  }
}

module.exports = { AuthController };
