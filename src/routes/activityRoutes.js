const express = require("express");
const { permissions } = require("../services/auth/permissions");

function createActivityRoutes({
  controller,
  requireAuthentication,
  requirePermission
}) {
  const router = express.Router();

  router.use(requireAuthentication);
  router.get(
    "/",
    requirePermission(permissions.listFiles),
    controller.list
  );

  return router;
}

module.exports = { createActivityRoutes };
