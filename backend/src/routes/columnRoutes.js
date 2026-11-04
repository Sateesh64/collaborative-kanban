const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const requireTenantAccess = require("../middleware/tenantAccess");

const {
  createColumn,
  getColumns
} = require("../controllers/columnController");

const router = express.Router();

router.use(authMiddleware);
router.use("/:tenantId/boards/:boardId/columns", requireTenantAccess);

router.post("/:tenantId/boards/:boardId/columns", createColumn);
router.get("/:tenantId/boards/:boardId/columns", getColumns);

module.exports = router;
