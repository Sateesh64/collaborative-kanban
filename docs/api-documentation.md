**API Documentation — Collaborative Kanban Board**

The backend is developed using Node.js, Express.js, PostgreSQL, and Prisma ORM. JWT authentication is used to secure protected endpoints.

**Base URL**

`http://localhost:5000/api`

**Authentication**

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Log in and receive a JWT |
| GET | `/auth/me` | Get authenticated user details |

Protected endpoints require the header:

`Authorization: Bearer YOUR_JWT_TOKEN`

**Organizations and Tenants**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/organizations` | Get accessible organizations |
| GET | `/organizations/:organizationId/tenants` | Get accessible tenants |
| POST | `/organizations/:organizationId/tenants` | Create a tenant (Organization Admin) |

**Kanban Boards**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/tenants/:tenantId/boards` | List tenant boards |
| POST | `/tenants/:tenantId/boards` | Create a board |
| GET | `/tenants/:tenantId/boards/:boardId/columns` | Get board columns |
| GET | `/tenants/:tenantId/boards/:boardId/tasks` | Get board tasks |
| POST | `/tenants/:tenantId/boards/:boardId/tasks` | Create a task |

**Task Management**

| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/tenants/:tenantId/boards/:boardId/tasks/:taskId` | Update task details |
| PATCH | `/tenants/:tenantId/boards/:boardId/tasks/:taskId/move` | Move a task |
| POST | `/tenants/:tenantId/boards/:boardId/tasks/:taskId/undo` | Undo a task movement |
| POST | `/tenants/:tenantId/boards/:boardId/tasks/:taskId/redo` | Redo a task movement |
| GET | `/tenants/:tenantId/boards/:boardId/tasks/:taskId/activity` | View task activity history |

**Security**

All tenant-specific routes validate JWT authentication and tenant membership. Organization Admins can access authorized organization tenants, while tenant members are restricted to their assigned tenants.

**Real-Time Communication**

Socket.IO handles board synchronization, online presence, and authorized board-room access. See `websocket-documentation.md` for additional details.