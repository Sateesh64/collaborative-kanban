const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const requireOrganizationAccess = require("../middleware/organizationAccess");

const {
  createTenant,
  getTenants
} = require("../controllers/tenantController");

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/:organizationId/tenants",
  requireOrganizationAccess,
  createTenant
);

router.get(
  "/:organizationId/tenants",
  getTenants
);

module.exports = router;
