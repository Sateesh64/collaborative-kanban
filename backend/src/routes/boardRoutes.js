const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const requireTenantAccess = require("../middleware/tenantAccess");

const {
  createBoard,
  getBoards
} = require("../controllers/boardController");

const router = express.Router();

router.use(authMiddleware);
router.use("/:tenantId/boards", requireTenantAccess);

router.post(
  "/:tenantId/boards",
  (req, res, next) => {
    if (
      !["ORG_ADMIN", "TENANT_ADMIN"].includes(req.membership?.role)
    ) {
      return res.status(403).json({
        message: "Only administrators can create boards"
      });
    }

    next();
  },
  createBoard
);
router.get("/:tenantId/boards", getBoards);

module.exports = router;
