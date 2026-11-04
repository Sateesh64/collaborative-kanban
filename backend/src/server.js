require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = require("./app");
const prisma = require("./config/prisma");
const { setSocketServer } = require("./sockets/socketEvents");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  "http://localhost:5173,http://localhost:5174"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);


const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

setSocketServer(io);


function getBoardRoom(tenantId, boardId) {
  return `tenant:${tenantId}:board:${boardId}`;
}


io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication token is required")
      );
    }

    if (!process.env.JWT_SECRET) {
      return next(
        new Error("JWT configuration is missing")
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId = decoded.id || decoded.userId;

    if (!userId) {
      return next(
        new Error("Invalid authentication token")
      );
    }

  
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!user) {
      return next(
        new Error("User not found")
      );
    }

    socket.data.user = user;

    next();
  } catch (error) {
    console.error(
      "Socket authentication error:",
      error.message
    );

    next(
      new Error("Invalid or expired authentication token")
    );
  }
});


async function emitPresence(room) {
  try {
    const connectedSockets = await io
      .in(room)
      .fetchSockets();

    const uniqueUsers = new Set();

    connectedSockets.forEach((client) => {
      const userId = client.data.user?.id;

      if (userId) {
        uniqueUsers.add(userId);
      }
    });

    io.to(room).emit("board:presence", {
      onlineUsers: connectedSockets.length,
      uniqueUsers: uniqueUsers.size,
    });

    console.log(
      `Presence updated: ${room} | ` +
      `${connectedSockets.length} connections | ` +
      `${uniqueUsers.size} unique users`
    );
  } catch (error) {
    console.error(
      "Presence update error:",
      error.message
    );
  }
}


io.on("connection", (socket) => {
  console.log(
    "Socket connected:",
    socket.id,
    "User:",
    socket.data.user.id
  );

 
  socket.on(
    "board:join",
    async (payload, callback) => {
      try {
        const { tenantId, boardId } = payload || {};

        if (
          typeof tenantId !== "string" ||
          !tenantId.trim() ||
          typeof boardId !== "string" ||
          !boardId.trim()
        ) {
          throw new Error(
            "Valid tenant and board IDs are required"
          );
        }

        const tenant = await prisma.tenant.findUnique({
          where: {
            id: tenantId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

        if (!tenant) {
          throw new Error("Tenant not found");
        }

        const membership =
          await prisma.membership.findFirst({
            where: {
              userId: socket.data.user.id,
              organizationId: tenant.organizationId,
              OR: [
                {
                  tenantId: null,
                  role: "ORG_ADMIN",
                },
                {
                  tenantId: tenant.id,
                  role: {
                    in: [
                      "TENANT_ADMIN",
                      "MEMBER",
                    ],
                  },
                },
              ],
            },
            select: {
              id: true,
              role: true,
            },
          });

        if (!membership) {
          throw new Error(
            "Access denied to this tenant"
          );
        }

        
        const board = await prisma.board.findFirst({
          where: {
            id: boardId,
            tenantId: tenant.id,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!board) {
          throw new Error(
            "Board not found in this tenant"
          );
        }

        
        const previousRooms = [
          ...socket.rooms,
        ].filter((room) =>
          room.startsWith("tenant:")
        );

        for (const previousRoom of previousRooms) {
          await socket.leave(previousRoom);

          await emitPresence(previousRoom);
        }

        
        const room = getBoardRoom(
          tenant.id,
          board.id
        );

        await socket.join(room);

        socket.data.activeRoom = room;
        socket.data.tenantId = tenant.id;
        socket.data.boardId = board.id;
        socket.data.role = membership.role;

        console.log(
          `User ${socket.data.user.id} joined ${room}`
        );

       
        await emitPresence(room);

       
        if (typeof callback === "function") {
          callback({
            success: true,
            message: "Joined board successfully",
            boardId: board.id,
            tenantId: tenant.id,
            role: membership.role,
          });
        }
      } catch (error) {
        console.error(
          "Board join error:",
          error.message
        );

        if (typeof callback === "function") {
          callback({
            success: false,
            message: error.message,
          });
        }
      }
    }
  );


  socket.on("board:leave", async () => {
    try {
      const room = socket.data.activeRoom;

      if (!room) return;

      await socket.leave(room);

      socket.data.activeRoom = null;
      socket.data.tenantId = null;
      socket.data.boardId = null;
      socket.data.role = null;

      await emitPresence(room);

      console.log(
        `User ${socket.data.user.id} left ${room}`
      );
    } catch (error) {
      console.error(
        "Board leave error:",
        error.message
      );
    }
  });

  socket.on("disconnect", async () => {
    console.log(
      "Socket disconnected:",
      socket.id
    );

    const room = socket.data.activeRoom;

    if (room) {
      await emitPresence(room);
    }
  });
});

server.listen(PORT, () => {
  console.log(
    `Server running at http://localhost:${PORT}`
  );

  console.log(
    "Socket.IO real-time collaboration enabled"
  );
});
