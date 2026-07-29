const express = require("express");

function createAuthRoutes({ controller }) {
  const router = express.Router();

  router.use(
    express.json({
      limit: "4kb",
      type: "application/json"
    })
  );
  router.get("/session", controller.getSession);
  router.post("/login", controller.login);
  router.post("/guest", controller.loginAsGuest);
  router.post("/logout", controller.logout);

  return router;
}

module.exports = { createAuthRoutes };
