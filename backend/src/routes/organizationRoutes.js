const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createOrganization,
  getOrganizations
} = require("../controllers/organizationController");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createOrganization);
router.get("/", getOrganizations);

module.exports = router;
