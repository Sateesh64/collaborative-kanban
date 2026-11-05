const prisma = require("../src/config/prisma");

const DEFAULT_COLUMNS = [
  { name: "To Do", position: 0 },
  { name: "In Progress", position: 1 },
  { name: "Done", position: 2 }
];

async function main() {
  const boards = await prisma.board.findMany({
    include: {
      columns: true,
      tenant: {
        select: {
          name: true
        }
      }
    }
  });

  for (const board of boards) {
    // Only repair boards with no columns.
    // Existing boards with columns are not modified.
    if (board.columns.length > 0) {
      console.log(
        `Skipped: ${board.name} (already has columns)`
      );
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Lock the board row to prevent concurrent repairs.
      await tx.$queryRaw`
        SELECT id FROM boards
        WHERE id = ${board.id}
        FOR UPDATE
      `;

      const existingCount = await tx.column.count({
        where: {
          boardId: board.id,
          tenantId: board.tenantId
        }
      });

      if (existingCount > 0) {
        return;
      }

      await tx.column.createMany({
        data: DEFAULT_COLUMNS.map((column) => ({
          tenantId: board.tenantId,
          boardId: board.id,
          name: column.name,
          position: column.position
        }))
      });
    });

    console.log(
      `Created columns for ${board.tenant.name} / ${board.name}`
    );
  }

  console.log("Board column repair completed.");
}

main()
  .catch((error) => {
    console.error("Repair failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
