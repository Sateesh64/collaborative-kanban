const prisma = require("../config/prisma");

const DEFAULT_COLUMNS = [
  { name: "To Do", position: 0 },
  { name: "In Progress", position: 1 },
  { name: "Done", position: 2 }
];

async function createBoard(req, res) {
  try {
    const { tenantId } = req.params;
    const { name, description } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      (description !== undefined &&
        (typeof description !== "string" ||
          description.length > 2000))
    ) {
      return res.status(400).json({
        message: "Enter a valid board name and description"
      });
    }

    // Create the board and its default columns together.
    const board = await prisma.$transaction(async (tx) => {
      const newBoard = await tx.board.create({
        data: {
          tenantId,
          name: name.trim(),
          description: description || null
        }
      });

      await tx.column.createMany({
        data: DEFAULT_COLUMNS.map((column) => ({
          tenantId,
          boardId: newBoard.id,
          name: column.name,
          position: column.position
        }))
      });

      return tx.board.findUnique({
        where: { id: newBoard.id },
        include: {
          columns: {
            orderBy: { position: "asc" }
          }
        }
      });
    });

    return res.status(201).json({
      message: "Board created successfully",
      board
    });
  } catch (error) {
    console.error("Create board error:", error);

    return res.status(500).json({
      message: "Unable to create board"
    });
  }
}

async function getBoards(req, res) {
  try {
    const { tenantId } = req.params;

    const boards = await prisma.board.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });

    return res.json({ boards });
  } catch (error) {
    console.error("Get boards error:", error);

    return res.status(500).json({
      message: "Unable to load boards"
    });
  }
}

module.exports = {
  createBoard,
  getBoards
};
