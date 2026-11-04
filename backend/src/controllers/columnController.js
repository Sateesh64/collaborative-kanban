const prisma = require("../config/prisma");

async function createColumn(req, res) {
  try {
    const { tenantId, boardId } = req.params;
    const { name } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 60
    ) {
      return res.status(400).json({
        message: "Enter a valid column name"
      });
    }

    const board = await prisma.board.findFirst({
      where: { id: boardId, tenantId }
    });

    if (!board) {
      return res.status(404).json({
        message: "Board not found in this tenant"
      });
    }

    const column = await prisma.$transaction(async (tx) => {
      // Lock the board row to serialize column creation.
      await tx.$queryRaw`
        SELECT id FROM boards
        WHERE id = ${boardId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      const lastColumn = await tx.column.findFirst({
        where: { boardId, tenantId },
        orderBy: { position: "desc" }
      });

      return tx.column.create({
        data: {
          name: name.trim(),
          boardId,
          tenantId,
          position: lastColumn ? lastColumn.position + 1 : 0
        }
      });
    });

    return res.status(201).json({
      message: "Column created successfully",
      column
    });
  } catch (error) {
    console.error("Create column error:", error);

    return res.status(500).json({
      message: "Unable to create column"
    });
  }
}

async function getColumns(req, res) {
  try {
    const { tenantId, boardId } = req.params;

    const board = await prisma.board.findFirst({
      where: { id: boardId, tenantId },
      select: { id: true }
    });

    if (!board) {
      return res.status(404).json({
        message: "Board not found in this tenant"
      });
    }

    const columns = await prisma.column.findMany({
      where: { boardId, tenantId },
      orderBy: { position: "asc" }
    });

    return res.json({ columns });
  } catch (error) {
    console.error("Get columns error:", error);

    return res.status(500).json({
      message: "Unable to load columns"
    });
  }
}

module.exports = {
  createColumn,
  getColumns
};
