const {
  AuthenticationError,
  AuthorizationError
} = require("../errors/ApplicationError");
const { permissions } = require("../services/auth/permissions");

const sessionCookieName = "cloudport_session";

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        const name =
          separatorIndex === -1
            ? part
            : part.slice(0, separatorIndex);
        const value =
          separatorIndex === -1
            ? ""
            : part.slice(separatorIndex + 1);

        try {
          return [name, decodeURIComponent(value)];
        } catch {
          return [name, ""];
        }
      })
  );
}

function createAuthenticationMiddleware(sessionService) {
  return (request, response, next) => {
    const cookies = parseCookies(request.get("cookie"));
    const token = cookies[sessionCookieName];
    const session = sessionService.get(token);

    request.sessionToken = session ? token : undefined;
    request.user = session?.user;
    next();
  };
}

function requireAuthentication(request, response, next) {
  if (!request.user) {
    next(
      new AuthenticationError(
        "Sign in before using this application"
      )
    );
    return;
  }

  next();
}

function requirePermission(permission) {
  return (request, response, next) => {
    if (!request.user) {
      next(
        new AuthenticationError(
          "Sign in before using this application"
        )
      );
      return;
    }

    if (!request.user.permissions.includes(permission)) {
      next(
        new AuthorizationError(
          "Your account cannot perform this action",
          {
            code: "INSUFFICIENT_PERMISSION"
          }
        )
      );
      return;
    }

    next();
  };
}

function createPageAccessMiddleware() {
  const pagePermissions = new Map([
    ["/", permissions.accessHome],
    ["/index.html", permissions.accessHome],
    ["/availablestorage.html", permissions.listFiles],
    ["/dashboard.html", permissions.accessDashboard],
    ["/managefiles.html", permissions.listFiles]
  ]);

  return (request, response, next) => {
    if (request.method !== "GET") {
      next();
      return;
    }

    const normalizedPath = request.path.toLowerCase();

    if (["/login", "/login.html"].includes(normalizedPath)) {
      if (request.user) {
        response.redirect("/");
      } else if (normalizedPath === "/login") {
        response.redirect("/login.html");
      } else {
        next();
      }
      return;
    }

    const requiredPermission = pagePermissions.get(normalizedPath);

    if (!requiredPermission) {
      next();
      return;
    }

    if (!request.user) {
      response.redirect("/login.html");
      return;
    }

    if (!request.user.permissions.includes(requiredPermission)) {
      response.redirect("/?access=denied");
      return;
    }

    next();
  };
}

module.exports = {
  createAuthenticationMiddleware,
  createPageAccessMiddleware,
  parseCookies,
  requireAuthentication,
  requirePermission,
  sessionCookieName
};
