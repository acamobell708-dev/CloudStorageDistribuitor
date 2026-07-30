const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createPageAccessMiddleware,
  parseCookies,
  requirePermission
} = require("../../src/middleware/authentication");

function invokeMiddleware(middleware, request) {
  let nextError;
  let nextCalled = false;
  let redirectedTo;
  const response = {
    redirect: (path) => {
      redirectedTo = path;
    }
  };

  middleware(request, response, (error) => {
    nextCalled = true;
    nextError = error;
  });

  return {
    nextCalled,
    nextError,
    redirectedTo
  };
}

test("parses the session cookie without truncating encoded values", () => {
  assert.deepEqual(
    parseCookies("other=value; cloudport_session=abc%20123"),
    {
      cloudport_session: "abc 123",
      other: "value"
    }
  );
});

test("enforces API permissions independently of the frontend", () => {
  const middleware = requirePermission("storage:purge");
  const denied = invokeMiddleware(middleware, {
    user: {
      permissions: ["page:home"]
    }
  });
  const allowed = invokeMiddleware(middleware, {
    user: {
      permissions: ["storage:purge"]
    }
  });

  assert.equal(denied.nextError.code, "INSUFFICIENT_PERMISSION");
  assert.equal(denied.nextError.statusCode, 403);
  assert.equal(allowed.nextCalled, true);
  assert.equal(allowed.nextError, undefined);
});

test("redirects unauthenticated and guest page requests safely", () => {
  const middleware = createPageAccessMiddleware();
  const signedOut = invokeMiddleware(middleware, {
    method: "GET",
    path: "/dashboard.html",
    user: undefined
  });
  const guestManage = invokeMiddleware(middleware, {
    method: "GET",
    path: "/manageFiles.html",
    user: {
      permissions: ["page:home", "page:dashboard"]
    }
  });
  const guestCapacity = invokeMiddleware(middleware, {
    method: "GET",
    path: "/availableStorage.html",
    user: {
      permissions: ["page:home", "page:dashboard"]
    }
  });
  const guestDashboard = invokeMiddleware(middleware, {
    method: "GET",
    path: "/dashboard.html",
    user: {
      permissions: ["page:home", "page:dashboard"]
    }
  });

  assert.equal(signedOut.redirectedTo, "/login.html");
  assert.equal(guestCapacity.redirectedTo, "/?access=denied");
  assert.equal(guestManage.redirectedTo, "/?access=denied");
  assert.equal(guestDashboard.nextCalled, true);
});
