**Real-Time Collaborative Kanban Board**

A full-stack Kanban application designed to help teams organize tasks and collaborate in real time. Built as part of the **JulleyOnline Full Stack Developer Intern Assignment**, with a focus on secure multi-tenant architecture, smooth task management, and real-time synchronization.

**Technologies Used**

Frontend: React.js, JavaScript, CSS, Vite, dnd-kit

Backend: Node.js, Express.js, Socket.IO

Database: PostgreSQL, Prisma ORM

Authentication & Security: JWT, Role-Based Access Control (RBAC), Tenant-Level Authorization

**Key Features**

- Secure user authentication using JWT.
- Multiple organizations and branches (tenants), each with separate boards and tasks.
- Role-based access control for Organization Admin, Tenant Admin, and Member.
- Drag-and-drop task management with task priorities.
- Real-time board synchronization using Socket.IO.
- Online user presence for collaborative workspaces.
- Undo and redo functionality for task movements.
- Task activity history for tracking changes.
- Optimistic concurrency control to prevent conflicting task updates.
- Tenant-level authorization to protect data between organizations and branches.

**Installation and Setup**

**Prerequisites**

- Node.js and npm
- PostgreSQL
- Git

**1. Clone the Repository**

```bash
git clone https://github.com/Sateesh64/collaborative-kanban.git
cd collaborative-kanban
```

**2. Configure the Backend**

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory using the supplied `.env.example` as a reference.

Configure the PostgreSQL connection string, JWT secret, and other required environment variables.

**3. Set Up the Database**

```bash
npx prisma generate
npx prisma migrate deploy
```

If the repository provides a database seed script, run it according to the backend package configuration.

**4. Start the Backend**

```bash
npm run dev
```

The backend runs at:

`http://localhost:5000`

**5. Start the Frontend**

Open a separate terminal from the project root.

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, typically:

`http://localhost:5173`

**Application Screenshots**

Screenshots of the application's login page, Kanban board, task details, multi-tenant functionality, and real-time collaboration are available in the [screenshots directory](screenshots/).

**Project Documentation**

- [API Documentation](docs/api-documentation.md)
- [WebSocket Documentation](docs/websocket-documentation.md)
- [System Architecture](docs/architecture.md)
- [Database ERD](docs/database-erd.md)


**Application Screenshots**

Screenshots are available in the [screenshots directory](screenshots/).


**Testing**

The application has been tested for authentication, tenant isolation, access permissions, task movements, and real-time collaboration.

Seven Socket.IO security checks passed, including authentication and cross-tenant access restrictions.

Frontend validation:

```bash
cd frontend
npm run lint
npm run build
```

Both commands completed successfully.

**Security**

The application uses JWT authentication, role-based access control, and tenant-level authorization. Task updates use optimistic concurrency control to detect conflicting changes.

**Developer**

**Kethavath Sateesh Naik**

JulleyOnline — Full Stack Developer Intern Assignment

GitHub: https://github.com/Sateesh64/collaborative-kanban