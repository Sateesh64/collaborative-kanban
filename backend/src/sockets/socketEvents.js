let io = null;

function setSocketServer(server) {
  io = server;
}

function getBoardRoom(tenantId, boardId) {
  return `tenant:${tenantId}:board:${boardId}`;
}

function emitBoardChange({
  tenantId,
  boardId,
  action,
  taskId,
}) {
  if (!io || !tenantId || !boardId) {
    return;
  }

  const room = getBoardRoom(tenantId, boardId);

  io.to(room).emit("board:changed", {
    tenantId,
    boardId,
    action: action || "updated",
    taskId: taskId || null,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[Socket.IO] Board changed: ${action} | Room: ${room}`
  );
}

module.exports = {
  setSocketServer,
  getBoardRoom,
  emitBoardChange,
};
