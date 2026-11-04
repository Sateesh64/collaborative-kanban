const prisma = require("../config/prisma");
const { emitBoardChange } = require("../sockets/socketEvents");

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function sendError(res, error, label) {
  console.error(label, error);
  return res.status(500).json({
    message: "An unexpected server error occurred",
  });
}

function getContext(req) {
  return {
    tenantId: req.params.tenantId,
    boardId: req.params.boardId,
    organizationId: req.tenant.organizationId,
    actorId: req.user.id,
  };
}

async function writeActivity(tx, context, action, entityId, details) {
  return tx.activityLog.create({
    data: {
      organizationId: context.organizationId,
      tenantId: context.tenantId,
      actorId: context.actorId,
      action,
      entityType: "TASK",
      entityId,
      details,
    },
  });
}

async function createTask(req, res) {
  try {
    const context = getContext(req);
    const { tenantId, boardId } = context;
    const { title, description, priority, columnId } = req.body || {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 200 ||
      typeof columnId !== "string" ||
      !columnId.trim() ||
      (description != null &&
        (typeof description !== "string" ||
          description.length > 5000)) ||
      (priority !== undefined &&
        !VALID_PRIORITIES.includes(priority))
    ) {
      return res.status(400).json({
        message: "Invalid task details",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Serialize task creation within the board.
      const boardRows = await tx.$queryRaw`
        SELECT id FROM boards
        WHERE id = ${boardId}
          AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (!boardRows.length) {
        return { status: 404, message: "Board not found" };
      }

      const column = await tx.column.findFirst({
        where: { id: columnId, boardId, tenantId },
      });

      if (!column) {
        return {
          status: 404,
          message: "Column not found in this board",
        };
      }

      const lastTask = await tx.task.findFirst({
        where: { tenantId, boardId, columnId },
        orderBy: { position: "desc" },
      });

      const task = await tx.task.create({
        data: {
          tenantId,
          boardId,
          columnId,
          title: title.trim(),
          description: description || null,
          priority: priority || "MEDIUM",
          position: lastTask ? lastTask.position + 1 : 0,
          createdById: context.actorId,
        },
      });

      await writeActivity(tx, context, "TASK_CREATED", task.id, {
        boardId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        columnId: task.columnId,
        version: task.version,
      });

      return { task };
    });

    if (result.status) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    emitBoardChange({
      tenantId,
      boardId,
      action: "task:created",
      taskId: result.task.id,
    });

    return res.status(201).json({
      message: "Task created successfully",
      task: result.task,
    });
  } catch (error) {
    return sendError(res, error, "Create task error:");
  }
}


async function getTasks(req, res) {
  try {
    const { tenantId, boardId } = req.params;

    const board = await prisma.board.findFirst({
      where: { id: boardId, tenantId },
      select: { id: true },
    });

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    const tasks = await prisma.task.findMany({
      where: { tenantId, boardId },
      orderBy: [
        { columnId: "asc" },
        { position: "asc" },
      ],
      include: {
        assignee: {
          select: { id: true, name: true },
        },
      },
    });

    return res.json({ tasks });
  } catch (error) {
    return sendError(res, error, "Get tasks error:");
  }
}


async function updateTask(req, res) {
  try {
    const context = getContext(req);
    const { tenantId, boardId } = context;
    const { taskId } = req.params;
    const { title, description, priority, version } = req.body || {};

    if (!Number.isInteger(version) || version < 1) {
      return res.status(400).json({
        message: "A valid task version is required",
      });
    }

    const data = {};

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.length > 200
      ) {
        return res.status(400).json({
          message: "Invalid task title",
        });
      }
      data.title = title.trim();
    }

    if (description !== undefined) {
      if (
        description !== null &&
        (typeof description !== "string" ||
          description.length > 5000)
      ) {
        return res.status(400).json({
          message: "Invalid task description",
        });
      }
      data.description = description;
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({
          message: "Invalid task priority",
        });
      }
      data.priority = priority;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({
        message: "No task changes provided",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id: taskId, tenantId, boardId },
      });

      if (!existing) {
        return { status: 404, message: "Task not found" };
      }

      const changes = {};

      for (const [field, newValue] of Object.entries(data)) {
        if (existing[field] !== newValue) {
          changes[field] = {
            from: existing[field],
            to: newValue,
          };
        }
      }

      const updated = await tx.task.updateMany({
        where: {
          id: taskId,
          tenantId,
          boardId,
          version,
        },
        data: {
          ...data,
          version: { increment: 1 },
        },
      });

      if (!updated.count) {
        return {
          status: 409,
          message:
            "Task was changed by another user. Refresh and retry.",
        };
      }

      const task = await tx.task.findFirst({
        where: { id: taskId, tenantId, boardId },
      });

      await writeActivity(tx, context, "TASK_UPDATED", task.id, {
        boardId,
        title: task.title,
        changes,
        previousVersion: version,
        newVersion: task.version,
      });

      return { task };
    });

    if (result.status) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    emitBoardChange({
      tenantId,
      boardId,
      action: "task:updated",
      taskId: result.task.id,
    });

    return res.json({
      message: "Task updated successfully",
      task: result.task,
    });
  } catch (error) {
    return sendError(res, error, "Update task error:");
  }
}


async function moveTask(req, res) {
  try {
    const context = getContext(req);
    const { tenantId, boardId } = context;
    const { taskId } = req.params;
    const { targetColumnId, targetIndex, version } = req.body || {};

    if (
      typeof targetColumnId !== "string" ||
      !targetColumnId.trim() ||
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      !Number.isInteger(version) ||
      version < 1
    ) {
      return res.status(400).json({
        message:
          "Valid column, position and task version are required",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      
      const boardRows = await tx.$queryRaw`
        SELECT id FROM boards
        WHERE id = ${boardId}
          AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (!boardRows.length) {
        return { status: 404, message: "Board not found" };
      }

      const task = await tx.task.findFirst({
        where: { id: taskId, tenantId, boardId },
      });

      if (!task) {
        return { status: 404, message: "Task not found" };
      }

      if (task.version !== version) {
        return {
          status: 409,
          message:
            "This task was updated. Refresh and try again.",
        };
      }

      const targetColumn = await tx.column.findFirst({
        where: {
          id: targetColumnId,
          tenantId,
          boardId,
        },
      });

      if (!targetColumn) {
        return {
          status: 404,
          message: "Target column not found",
        };
      }

      const destinationTasks = await tx.task.findMany({
        where: {
          tenantId,
          boardId,
          columnId: targetColumnId,
          id: { not: taskId },
        },
        orderBy: [
          { position: "asc" },
          { id: "asc" },
        ],
      });

      if (targetIndex > destinationTasks.length) {
        return {
          status: 400,
          message: "Target position is outside the column",
        };
      }

      const previous = destinationTasks[targetIndex - 1];
      const next = destinationTasks[targetIndex];

      let newPosition;

      if (!previous && !next) {
        newPosition = 0;
      } else if (!previous) {
        newPosition = next.position - 1;
      } else if (!next) {
        newPosition = previous.position + 1;
      } else {
        newPosition = (previous.position + next.position) / 2;
      }

      if (
        previous &&
        next &&
        (newPosition === previous.position ||
          newPosition === next.position)
      ) {
        for (let i = 0; i < destinationTasks.length; i++) {
          await tx.task.update({
            where: { id: destinationTasks[i].id },
            data: { position: i * 1000 },
          });
        }

        const before =
          targetIndex > 0 ? (targetIndex - 1) * 1000 : null;

        const after =
          targetIndex < destinationTasks.length
            ? targetIndex * 1000
            : null;

        newPosition =
          before === null
            ? after - 1000
            : after === null
              ? before + 1000
              : (before + after) / 2;
      }

      const updated = await tx.task.updateMany({
        where: {
          id: taskId,
          tenantId,
          boardId,
          version,
        },
        data: {
          columnId: targetColumnId,
          position: newPosition,
          version: { increment: 1 },
        },
      });

      if (!updated.count) {
        return {
          status: 409,
          message: "Task changed during the move",
        };
      }

      const movedTask = await tx.task.findUnique({
        where: { id: taskId },
      });

      await writeActivity(tx, context, "TASK_MOVED", taskId, {
        boardId,
        title: task.title,
        fromColumnId: task.columnId,
        toColumnId: targetColumnId,
        fromPosition: task.position,
        toPosition: movedTask.position,
        previousVersion: version,
        newVersion: movedTask.version,
      });

      return { task: movedTask };
    });

    if (result.status) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    emitBoardChange({
      tenantId,
      boardId,
      action: "task:moved",
      taskId: result.task.id,
    });

    return res.json({
      message: "Task moved successfully",
      task: result.task,
    });
  } catch (error) {
    return sendError(res, error, "Move task error:");
  }
}

async function getBoardActivity(req, res) {
  try {
    const { tenantId, boardId } = req.params;

    const board = await prisma.board.findFirst({
      where: { id: boardId, tenantId },
      select: { id: true },
    });

    if (!board) {
      return res.status(404).json({
        message: "Board not found",
      });
    }

    const parsedLimit = Number(req.query.limit);
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;

    const activities = await prisma.activityLog.findMany({
      where: {
        tenantId,
        entityType: "TASK",
        details: {
          path: ["boardId"],
          equals: boardId,
        },
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
    });

    return res.json({ activities });
  } catch (error) {
    return sendError(res, error, "Get board activity error:");
  }
}


async function getTaskActivity(req, res) {
  try {
    const { tenantId, boardId, taskId } = req.params;

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId,
        boardId,
      },
      select: { id: true },
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const activities = await prisma.activityLog.findMany({
      where: {
        tenantId,
        entityType: "TASK",
        entityId: taskId,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 100,
    });

    return res.json({ activities });
  } catch (error) {
    return sendError(res, error, "Get task activity error:");
  }
}


async function changeMovementHistory(req, res, direction) {
  try {
    const context = getContext(req);
    const { tenantId, boardId } = context;
    const { taskId } = req.params;
    const { activityId, version } = req.body || {};

    if (
      typeof activityId !== "string" ||
      !activityId.trim() ||
      !Number.isInteger(version) ||
      version < 1
    ) {
      return res.status(400).json({
        message: "Valid activityId and version are required",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const boardRows = await tx.$queryRaw`
        SELECT id FROM boards
        WHERE id = ${boardId}
          AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (!boardRows.length) {
        return { status: 404, message: "Board not found" };
      }

      const task = await tx.task.findFirst({
        where: { id: taskId, tenantId, boardId },
      });

      if (!task) {
        return { status: 404, message: "Task not found" };
      }

      if (task.version !== version) {
        return {
          status: 409,
          message: "Task has changed. Refresh before trying again.",
        };
      }

      const latest = await tx.activityLog.findFirst({
        where: {
          tenantId,
          entityType: "TASK",
          entityId: taskId,
          action: {
            in: [
              "TASK_MOVED",
              "TASK_MOVE_UNDONE",
              "TASK_MOVE_REDONE",
            ],
          },
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
      });

      if (!latest || latest.id !== activityId) {
        return {
          status: 409,
          message:
            "Movement history is out of date. Refresh and retry.",
        };
      }

      if (
        direction === "undo" &&
        !["TASK_MOVED", "TASK_MOVE_REDONE"].includes(latest.action)
      ) {
        return {
          status: 409,
          message: "This movement cannot be undone.",
        };
      }

      if (
        direction === "redo" &&
        latest.action !== "TASK_MOVE_UNDONE"
      ) {
        return {
          status: 409,
          message: "There is no movement available to redo.",
        };
      }

      const details = latest.details || {};

      const targetColumnId =
        direction === "undo"
          ? details.fromColumnId
          : details.fromColumnId;

      const targetPosition =
        direction === "undo"
          ? details.fromPosition
          : details.fromPosition;

      if (
        typeof targetColumnId !== "string" ||
        !Number.isFinite(targetPosition)
      ) {
        return {
          status: 409,
          message:
            "Movement history lacks a valid destination.",
        };
      }

      const expectedColumn = details.toColumnId;

      if (task.columnId !== expectedColumn) {
        return {
          status: 409,
          message:
            "Task is no longer in the expected column.",
        };
      }

      const column = await tx.column.findFirst({
        where: {
          id: targetColumnId,
          tenantId,
          boardId,
        },
      });

      if (!column) {
        return {
          status: 404,
          message:
            "Destination column no longer exists",
        };
      }

      const siblings = await tx.task.findMany({
        where: {
          tenantId,
          boardId,
          columnId: targetColumnId,
          id: { not: taskId },
        },
        orderBy: [
          { position: "asc" },
          { id: "asc" },
        ],
      });

      const insertionIndex = siblings.filter(
        (item) => item.position < targetPosition
      ).length;

      const before = siblings[insertionIndex - 1];
      const after = siblings[insertionIndex];

      let position =
        !before && !after
          ? 0
          : !before
            ? after.position - 1
            : !after
              ? before.position + 1
              : (before.position + after.position) / 2;

      if (
        before &&
        after &&
        (position === before.position ||
          position === after.position)
      ) {
        for (let i = 0; i < siblings.length; i++) {
          await tx.task.update({
            where: { id: siblings[i].id },
            data: { position: i * 1000 },
          });
        }

        const left = insertionIndex
          ? (insertionIndex - 1) * 1000
          : null;

        const right =
          insertionIndex < siblings.length
            ? insertionIndex * 1000
            : null;

        position =
          left === null
            ? right - 1000
            : right === null
              ? left + 1000
              : (left + right) / 2;
      }

      const changed = await tx.task.updateMany({
        where: {
          id: taskId,
          tenantId,
          boardId,
          version,
        },
        data: {
          columnId: targetColumnId,
          position,
          version: { increment: 1 },
        },
      });

      if (!changed.count) {
        return {
          status: 409,
          message:
            "Task changed during the operation",
        };
      }

      const updated = await tx.task.findUnique({
        where: { id: taskId },
      });

      const activity = await writeActivity(
        tx,
        context,
        direction === "undo"
          ? "TASK_MOVE_UNDONE"
          : "TASK_MOVE_REDONE",
        taskId,
        {
          boardId,
          sourceActivityId: latest.id,
          fromColumnId: task.columnId,
          toColumnId: targetColumnId,
          fromPosition: task.position,
          toPosition: updated.position,
          previousVersion: version,
          newVersion: updated.version,
        }
      );

      return { task: updated, activity };
    });

    if (result.status) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    emitBoardChange({
      tenantId,
      boardId,
      action:
        direction === "undo"
          ? "task:undo"
          : "task:redo",
      taskId: result.task.id,
    });

    return res.json({
      message:
        direction === "undo"
          ? "Movement undone successfully"
          : "Movement redone successfully",
      task: result.task,
      activity: result.activity,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Undo/redo task movement error:"
    );
  }
}

async function undoTaskMove(req, res) {
  return changeMovementHistory(req, res, "undo");
}

async function redoTaskMove(req, res) {
  return changeMovementHistory(req, res, "redo");
}

module.exports = {
  createTask,
  getTasks,
  updateTask,
  moveTask,
  getBoardActivity,
  getTaskActivity,
  undoTaskMove,
  redoTaskMove,
};
