**Real-Time Collaborative Kanban Board**

A full-stack Kanban application designed to help teams organize tasks and collaborate in real time. Built as part of the JulleyOnline Full Stack Developer Intern assignment, with a focus on secure multi-tenant architecture, smooth task management, and real-time synchronization.

**Technologies Used**

React.js, JavaScript, CSS, Node.js, Express.js, PostgreSQL, Prisma ORM, Socket.IO, JWT, and dnd-kit.

**Key Features**

- Secure user registration and login using JWT authentication.
- Multiple organizations and tenants with separate boards and tasks.
- Role-based access control for Organization Admin, Tenant Admin, and Member.
- Drag-and-drop task management with priorities and activity history.
- Real-time board synchronization and online user presence using Socket.IO.
- Undo and redo functionality for task movements.
- Optimistic concurrency control to handle conflicting updates.
- Tenant-level authorization to protect organization data.

**Installation and Setup**

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd collaborative-kanban
```

Set up the backend:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Before starting the backend, configure `backend/.env` with your PostgreSQL connection details and JWT secret.

Open another terminal from the project root and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

**Testing**

The application has been tested for authentication, tenant isolation, access permissions, task movements, and real-time collaboration. All seven Socket.IO security checks passed, and the frontend production build completed successfully.

**Developer**

Kethavath Sateesh Naik

JulleyOnline — Full Stack Developer Intern Assignment