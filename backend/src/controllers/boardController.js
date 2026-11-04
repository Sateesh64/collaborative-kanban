const prisma = require("../config/prisma");

async function createBoard(req, res) {
  try {
    const { tenantId } = req.params;
    const { name, description } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      (description !== undefined &&
        (typeof description !== "string" || description.length > 2000))
    ) {
      return res.status(400).json({
        message: "Enter a valid board name and description"
      });
    }

    const board = await prisma.board.create({
      data: {
        tenantId,
        name: name.trim(),
        description: description || null
      }
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
