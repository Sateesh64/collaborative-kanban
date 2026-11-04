const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const requireTenantAccess = require("../middleware/tenantAccess");

const {
  createTask,
  getTasks,
  updateTask,
  moveTask,
  getBoardActivity,
getTaskActivity,
undoTaskMove,
redoTaskMove
} = require("../controllers/taskController");

const router = express.Router();

router.use(authMiddleware);
router.use("/:tenantId/boards/:boardId/tasks", requireTenantAccess);

router.post("/:tenantId/boards/:boardId/tasks", createTask);
router.get("/:tenantId/boards/:boardId/tasks", getTasks);
router.patch("/:tenantId/boards/:boardId/tasks/:taskId", updateTask);
router.patch(
  "/:tenantId/boards/:boardId/tasks/:taskId/move",
  moveTask
);

router.get(
  "/:tenantId/boards/:boardId/activity",
  authMiddleware,
  requireTenantAccess,
  getBoardActivity
);

router.get(
  "/:tenantId/boards/:boardId/tasks/:taskId/activity",
  authMiddleware,
  requireTenantAccess,
  getTaskActivity
);

router.post(
  "/:tenantId/boards/:boardId/tasks/:taskId/undo",
  undoTaskMove
);

router.post(
  "/:tenantId/boards/:boardId/tasks/:taskId/redo",
  redoTaskMove
);

module.exports = router;
