import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import BoardRealtime from "./components/BoardRealtime";
import KanbanColumn from "./components/KanbanColumn";
import TaskDetails from "./components/TaskDetails";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const TOKEN_KEY = "kanban_token";

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
        data.error ||
        `Request failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function extractList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function boardCollisionDetection(args) {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  return rectIntersection(args);
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || ""
  );
  const [authMode, setAuthMode] = useState("login");
const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");

  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const [showCreateOrganization, setShowCreateOrganization] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);

  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");

  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState("");

  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [savingTask, setSavingTask] = useState(false);

  const [error, setError] = useState("");
 

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState(null);
  // A single-step, session-local movement history. Server versions remain authoritative.
  const [undoEntry, setUndoEntry] = useState(null);
  const [redoEntry, setRedoEntry] = useState(null);

  const movingRef = useRef(false);
  const boardRequestRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedColumns = [...columns].sort(
    (a, b) => Number(a.position) - Number(b.position)
  );

  const selectedBoard = boards.find(
    (board) => board.id === boardId
  );
  const selectedOrganization = organizations.find((org) => org.id === organizationId);
  const isOrgAdmin = selectedOrganization?.role === "ORG_ADMIN";

  const loadBoardData = useCallback(
    async (selectedTenantId, selectedBoardId) => {
      if (!selectedTenantId || !selectedBoardId) {
        return false;
      }

      const requestId = ++boardRequestRef.current;

      setRefreshing(true);
      setError("");

      try {
        const base =
          `/api/tenants/${selectedTenantId}` +
          `/boards/${selectedBoardId}`;

        const [columnData, taskData] = await Promise.all([
          request(`${base}/columns`),
          request(`${base}/tasks`),
        ]);

        if (requestId !== boardRequestRef.current) {
          return false;
        }

        setColumns(extractList(columnData, "columns"));
        setTasks(extractList(taskData, "tasks"));

        return true;
      } catch (err) {
        if (requestId === boardRequestRef.current) {
          setError(err.message);
        }
        return false;
      } finally {
        if (requestId === boardRequestRef.current) {
          setRefreshing(false);
        }
      }
    },
    []
  );

  const handleRealtimeChange = useCallback(() => {
    if (tenantId && boardId) {
      void loadBoardData(tenantId, boardId);
    }
  }, [tenantId, boardId, loadBoardData]);

  useEffect(() => {
  if (!token) {
    return;
  }

  let cancelled = false;

  async function fetchOrganizations() {
    setOrganizationsLoaded(false);


    try {
      const data = await request("/api/organizations");

      if (cancelled) return;

      const items = extractList(data, "organizations");

      setOrganizations(items);
      setOrganizationId(items[0]?.id || "");
    } catch (err) {
      if (!cancelled) {
        setError(err.message);
      }
    } finally {
      if (!cancelled) {
        setOrganizationsLoaded(true);
      }
    }
  }

  void fetchOrganizations();

  return () => {
    cancelled = true;
  };
}, [token]);

  useEffect(() => {
    if (!token || !organizationId) return;

    let cancelled = false;

    async function fetchTenants() {
      try {
        const data = await request(
          `/api/organizations/${organizationId}/tenants`
        );

        if (cancelled) return;

        const items = extractList(data, "tenants");
        setTenants(items);
        setTenantId(items[0]?.id || "");
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    void fetchTenants();

    return () => {
      cancelled = true;
    };
  }, [token, organizationId]);

  useEffect(() => {
    if (!token || !tenantId) return;

    let cancelled = false;

    async function fetchBoards() {
      try {
        const data = await request(
          `/api/tenants/${tenantId}/boards`
        );

        if (cancelled) return;

        const items = extractList(data, "boards");
        setBoards(items);
        setBoardId(items[0]?.id || "");
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    void fetchBoards();

    return () => {
      cancelled = true;
    };
  }, [token, tenantId]);

  useEffect(() => {
    if (!token || !tenantId || !boardId) return;

    let cancelled = false;

    async function fetchBoard() {
      try {
        const base =
          `/api/tenants/${tenantId}/boards/${boardId}`;

        const [columnData, taskData] = await Promise.all([
          request(`${base}/columns`),
          request(`${base}/tasks`),
        ]);

        if (cancelled) return;

        setColumns(extractList(columnData, "columns"));
        setTasks(extractList(taskData, "tasks"));
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    void fetchBoard();

    return () => {
      cancelled = true;
    };
  }, [token, tenantId, boardId]);

  async function handleRegister(event) {
  event.preventDefault();

  setError("");
  setLoading(true);

  try {
    const data = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password
      })
    });

    if (!data.token) {
      throw new Error("Registration response did not include a token.");
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setPassword("");
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}
async function handleCreateWorkspace(event) {
  event.preventDefault();

  const name = workspaceName.trim();

  if (!name) return;

  setCreatingWorkspace(true);
  setError("");

  try {
    const slug =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 45) || "workspace";

    const data = await request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({
        name,
        slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`
      })
    });

    const organization = data.organization;

    if (!organization?.id) {
      throw new Error("Organization was not returned by the server.");
    }

    boardRequestRef.current += 1;
    setTenants([]);
    setTenantId("");
    setBoards([]);
    setBoardId("");
    setColumns([]);
    setTasks([]);
    setSelectedTask(null);
    clearMovementHistory();
    setOrganizations((previous) => [...previous, { ...organization, role: "ORG_ADMIN" }]);
    setOrganizationId(organization.id);
    setWorkspaceName("");
    setShowCreateOrganization(false);
  } catch (err) {
    setError(err.message);
  } finally {
    setCreatingWorkspace(false);
  }
}

  async function handleCreateBranch(event) {
    event.preventDefault();
    const name = branchName.trim();
    const currentOrganizationId = organizationId;
    if (!name || !currentOrganizationId || !isOrgAdmin) return;

    setCreatingBranch(true);
    setError("");
    try {
      const slug = name.toLowerCase().normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "").slice(0, 45) || "branch";
      const data = await request(`/api/organizations/${currentOrganizationId}/tenants`, {
        method: "POST",
        body: JSON.stringify({ name, slug: `${slug}-${crypto.randomUUID().slice(0, 8)}` }),
      });
      if (!data.tenant?.id) throw new Error("Branch was not returned by the server.");

      boardRequestRef.current += 1;
      setTenants((previous) => [...previous, data.tenant]);
      setTenantId(data.tenant.id);
      setBoards([]);
      setBoardId("");
      setColumns([]);
      setTasks([]);
      setSelectedTask(null);
      clearMovementHistory();
      setBranchName("");
      setShowCreateBranch(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingBranch(false);
    }
  }

  async function handleCreateBoard(event) {
    event.preventDefault();
    const name = boardName.trim();
    const currentTenantId = tenantId;
    if (!name || !currentTenantId) return;

    setCreatingBoard(true);
    setError("");
    try {
      const data = await request(`/api/tenants/${currentTenantId}/boards`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (!data.board?.id) throw new Error("Board was not returned by the server.");

      boardRequestRef.current += 1;
      setBoards((previous) => [data.board, ...previous]);
      setBoardId(data.board.id);
      setColumns([]);
      setTasks([]);
      setSelectedTask(null);
      clearMovementHistory();
      setBoardName("");
      setShowCreateBoard(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingBoard(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!data.token) {
        throw new Error("Login response did not include a token.");
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function clearMovementHistory() {
    setUndoEntry(null);
    setRedoEntry(null);
  }

  async function findMoveActivity(taskId, taskVersion) {
    const base = `/api/tenants/${tenantId}/boards/${boardId}`;
    const data = await request(`${base}/tasks/${taskId}/activity`);
    const activities = extractList(data, "activities");
    return activities.find((activity) =>
      activity.action === "TASK_MOVED" &&
      Number(activity.details?.newVersion) === Number(taskVersion)
    ) || null;
  }

  async function handleHistoryAction(direction) {
    const entry = direction === "undo" ? undoEntry : redoEntry;
    if (!entry || movingRef.current || !tenantId || !boardId) return;

    movingRef.current = true;
    setBusyTaskId(entry.taskId);
    setError("");
    try {
      const path =
        `/api/tenants/${tenantId}/boards/${boardId}` +
        `/tasks/${entry.taskId}/${direction}`;
      const result = await request(path, {
        method: "POST",
        body: JSON.stringify({
          activityId: entry.activityId,
          version: entry.version,
        }),
      });

      if (!result.task || !result.activity?.id) {
        throw new Error("Server did not return updated movement history.");
      }

      const nextEntry = {
        taskId: result.task.id,
        activityId: result.activity.id,
        version: result.task.version,
      };

      if (direction === "undo") {
        setUndoEntry(null);
        setRedoEntry(nextEntry);
      } else {
        setRedoEntry(null);
        setUndoEntry(nextEntry);
      }

      const refreshed = await loadBoardData(tenantId, boardId);
      if (!refreshed) {
  setError("Movement saved, but board refresh failed.");
}
    } catch (err) {
      if (err.status === 409 || err.status === 404) {
        clearMovementHistory();
      }
      await loadBoardData(tenantId, boardId);
      setError(err.message || `Unable to ${direction} movement.`);
    } finally {
      movingRef.current = false;
      setBusyTaskId(null);
    }
  }

  function signOut() {
  boardRequestRef.current += 1;

  localStorage.removeItem(TOKEN_KEY);

  setToken("");
  setAuthMode("login");
  setName("");
  setEmail("");
  setPassword("");

  setOrganizations([]);
  setOrganizationId("");
  setTenants([]);
  setTenantId("");
  setBoards([]);
  setBoardId("");
  setColumns([]);
  setTasks([]);
  setNewTask("");
  setSelectedTask(null);
  clearMovementHistory();
  setError("");
  setOrganizationsLoaded(false);
  setShowCreateOrganization(false);
  setShowCreateBranch(false);
  setShowCreateBoard(false);
  setWorkspaceName("");
  setBranchName("");
  setBoardName("");
}
  function handleOrganizationChange(event) {
    boardRequestRef.current += 1;

    setShowCreateBranch(false);
    setShowCreateBoard(false);
    setOrganizationId(event.target.value);
    setTenants([]);
    setTenantId("");
    setBoards([]);
    setBoardId("");
    setColumns([]);
    setTasks([]);
    setSelectedTask(null);
    clearMovementHistory();
    setError("");
  }

  function handleTenantChange(event) {
    boardRequestRef.current += 1;

    setShowCreateBoard(false);
    setTenantId(event.target.value);
    setBoards([]);
    setBoardId("");
    setColumns([]);
    setTasks([]);
    setSelectedTask(null);
    clearMovementHistory();
    setError("");
  }

  function handleBoardChange(event) {
    boardRequestRef.current += 1;

    setBoardId(event.target.value);
    setColumns([]);
    setTasks([]);
    setSelectedTask(null);
    clearMovementHistory();
    setError("");
  }

  async function handleRefresh() {
    if (!tenantId || !boardId || refreshing) return;
    await loadBoardData(tenantId, boardId);
  }

  async function handleCreateTask(event) {
    event.preventDefault();

    const title = newTask.trim();

    if (!title || !boardId || !sortedColumns.length) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const base =
        `/api/tenants/${tenantId}/boards/${boardId}`;

      await request(`${base}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title,
          columnId: sortedColumns[0].id,
          priority: "MEDIUM",
        }),
      });

      setNewTask("");

      const refreshed = await loadBoardData(tenantId, boardId);
      if (!refreshed) {
        setError("Task created, but the board could not be refreshed.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function moveTask(task, targetColumnId, targetIndex) {
    if (!task || !targetColumnId || movingRef.current) {
      return;
    }

    movingRef.current = true;
    setBusyTaskId(task.id);
    setError("");
    try {
      const path =
        `/api/tenants/${tenantId}` +
        `/boards/${boardId}` +
        `/tasks/${task.id}/move`;

      const moveResult = await request(path, {
        method: "PATCH",
        body: JSON.stringify({
          targetColumnId,
          targetIndex,
          version: task.version,
        }),
      });

      clearMovementHistory();
      const refreshed = await loadBoardData(tenantId, boardId);
      if (!refreshed) {
        setError("Task moved, but the board could not be refreshed.");
      }

      try {
        const activity = await findMoveActivity(
          task.id,
          moveResult.task?.version
        );
        if (activity) {
          setUndoEntry({
            taskId: task.id,
            activityId: activity.id,
            version: moveResult.task.version,
          });
        }
      } catch (historyError) {
        console.warn("Unable to load movement activity:", historyError);
      }

    } catch (err) {
      await loadBoardData(tenantId, boardId);
      setError(err.message);
    } finally {
      movingRef.current = false;
      setBusyTaskId(null);
    }
  }

  function handleMoveTask(task, direction) {
    const currentIndex = sortedColumns.findIndex(
      (column) => column.id === task.columnId
    );

    if (currentIndex === -1) return;

    const targetColumn =
      sortedColumns[currentIndex + direction];

    if (!targetColumn) return;

    const targetTasks = tasks
      .filter((item) => item.columnId === targetColumn.id)
      .sort(
        (a, b) =>
          Number(a.position) - Number(b.position)
      );

    void moveTask(
      task,
      targetColumn.id,
      targetTasks.length
    );
  }

  function handleDragEnd({ active, over }) {
    if (!over || movingRef.current) return;

    const draggedTask = tasks.find(
      (task) => task.id === active.id
    );

    if (!draggedTask) return;

    const targetTask = tasks.find(
      (task) => task.id === over.id
    );

    const targetColumnId = targetTask
      ? targetTask.columnId
      : over.data.current?.columnId;

    if (!targetColumnId || active.id === over.id) {
      return;
    }

    const destinationTasks = tasks
      .filter(
        (task) =>
          task.columnId === targetColumnId &&
          task.id !== draggedTask.id
      )
      .sort(
        (a, b) =>
          Number(a.position) - Number(b.position)
      );

    let targetIndex = destinationTasks.length;

    if (targetTask) {
      const index = destinationTasks.findIndex(
        (task) => task.id === targetTask.id
      );

      if (index >= 0) {
        targetIndex = index;
      }
    }

    if (draggedTask.columnId === targetColumnId) {
      const currentTasks = tasks
        .filter(
          (task) => task.columnId === draggedTask.columnId
        )
        .sort(
          (a, b) =>
            Number(a.position) - Number(b.position)
        );

      const currentIndex = currentTasks.findIndex(
        (task) => task.id === draggedTask.id
      );

      if (currentIndex === targetIndex) return;
    }

    void moveTask(
      draggedTask,
      targetColumnId,
      targetIndex
    );
  }

  function handleTaskClick(task) {
    setError("");
    setSelectedTask(task);
  }

  async function handleSaveTask({
    taskId,
    title,
    description,
    priority,
    version,
  }) {
    if (!tenantId || !boardId || savingTask) {
      throw new Error("Unable to save task right now.");
    }

    setSavingTask(true);
    setError("");
    try {
      const path =
        `/api/tenants/${tenantId}` +
        `/boards/${boardId}/tasks/${taskId}`;

      await request(path, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description,
          priority,
          version,
        }),
      });

      setSelectedTask(null);
      clearMovementHistory();

      const refreshed = await loadBoardData(tenantId, boardId);
      if (!refreshed) {
        setError("Task saved, but the board could not be refreshed.");
      }

      return true;
    } catch (err) {
      if (err.status === 409) {
        await loadBoardData(tenantId, boardId);
        setSelectedTask(null);

        setError(
          "This task was modified by another user. " +
          "Reopen it to edit the latest version."
        );

       throw new Error(
  "Task conflict. Reopen the task to load its latest version.",
  { cause: err }
);
      }

      setError(err.message || "Unable to save task.");
      throw err;
    } finally {
      setSavingTask(false);
    }
  }

  if (!token) {
    return (
      <div className="login-page">
        <form
  key={authMode}
  className="login-card"
  autoComplete={authMode === "register" ? "off" : "on"}
  onSubmit={authMode === "register" ? handleRegister : handleLogin}
>
        <h1>Kanban</h1>

        <p>
          {authMode === "register"
            ? "Create your account"
            : "Sign in to your workspace"}
        </p>

        {authMode === "register" && (
          <>
        
           <label htmlFor="name">Full Name</label>
<input
  id="name"
  type="text"
  value={name}
  onChange={(event) => setName(event.target.value)}
  autoComplete="name"
  required
  maxLength={100}
/>
          </>
        )}

       <label htmlFor="email">Email</label>
<input
  id="email"
  type="email"
  value={email}
  onChange={(event) => setEmail(event.target.value)}
  autoComplete={authMode === "register" ? "off" : "username"}
  required
/>

        <label htmlFor="password">Password</label>
       <input
  id="password"
  type="password"
  value={password}
  onChange={(event) => setPassword(event.target.value)}
  autoComplete={
    authMode === "register"
      ? "new-password"
      : "current-password"
  }
  minLength={authMode === "register" ? 8 : undefined}
  required
/>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : authMode === "register"
              ? "Register"
              : "Sign in"}
        </button>

        <p>
          {authMode === "register"
            ? "Already have an account?"
            : "Don't have an account?"}
        </p>

        <button
          type="button"
          className="secondary"
          onClick={() => {
  setAuthMode(
    authMode === "register" ? "login" : "register"
  );

  setName("");
  setEmail("");
  setPassword("");
  setError("");
}}
        >
          {authMode === "register"
            ? "Sign in"
            : "Create account"}
        </button>
      </form>
    </div>
  );
}

  return (
    <div className="workspace">
      <aside className="sidebar">
        <h2>Kanban</h2>
        <p className="muted">Your workspace</p>

        <label htmlFor="organization">
          Organization
        </label>
        <select
          id="organization"
          value={organizationId}
          onChange={handleOrganizationChange}
        >
          <option value="">Select organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>

        <button type="button" className="secondary"
          onClick={() => setShowCreateOrganization((previous) => !previous)}>
          + Create Organization
        </button>
        {showCreateOrganization && (
          <form onSubmit={handleCreateWorkspace}>
            <label htmlFor="workspaceName">Organization Name</label>
            <input id="workspaceName" type="text" value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              maxLength={100} placeholder="Enter organization name" required />
            <button type="submit" disabled={creatingWorkspace}>
              {creatingWorkspace ? "Creating..." : "Save Organization"}
            </button>
          </form>
        )}

        <label htmlFor="tenant">Branch</label>
        <select
          id="tenant"
          value={tenantId}
          onChange={handleTenantChange}
          disabled={!organizationId}
        >
          <option value="">Select branch</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>

        {organizationId && isOrgAdmin && (
          <>
            <button type="button" className="secondary"
              onClick={() => setShowCreateBranch((previous) => !previous)}>
              + Create Branch
            </button>
            {showCreateBranch && (
              <form onSubmit={handleCreateBranch}>
                <label htmlFor="branchName">Branch Name</label>
                <input id="branchName" type="text" value={branchName}
                  onChange={(event) => setBranchName(event.target.value)}
                  maxLength={100} placeholder="Example: Hyderabad" required />
                <button type="submit" disabled={creatingBranch}>
                  {creatingBranch ? "Creating..." : "Save Branch"}
                </button>
              </form>
            )}
          </>
        )}

        <label htmlFor="board">Board</label>
        <select
          id="board"
          value={boardId}
          onChange={handleBoardChange}
          disabled={!tenantId}
        >
          <option value="">Select board</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>

        {tenantId && (
          <>
            <button type="button" className="secondary"
              onClick={() => setShowCreateBoard((previous) => !previous)}>
              + Create Board
            </button>
            {showCreateBoard && (
              <form onSubmit={handleCreateBoard}>
                <label htmlFor="boardName">Board Name</label>
                <input id="boardName" type="text" value={boardName}
                  onChange={(event) => setBoardName(event.target.value)}
                  maxLength={100} placeholder="Example: Project Kanban Board" required />
                <button type="submit" disabled={creatingBoard}>
                  {creatingBoard ? "Creating..." : "Save Board"}
                </button>
              </form>
            )}
          </>
        )}

        <button
          type="button"
          className="secondary signout-button"
          onClick={signOut}
        >
          Sign out
        </button>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="muted">Workspace / Board</p>

            <h1>
              {selectedBoard?.name || "Select a board"}
            </h1>

            {boardId && (
              <BoardRealtime
                token={token}
                tenantId={tenantId}
                boardId={boardId}
                onBoardChanged={handleRealtimeChange}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => void handleHistoryAction("undo")}
              disabled={!undoEntry || Boolean(busyTaskId) || refreshing}
              title="Undo the latest task movement"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void handleHistoryAction("redo")}
              disabled={!redoEntry || Boolean(busyTaskId) || refreshing}
              title="Redo the last undone movement"
            >
              ↷ Redo
            </button>
            <button
              type="button"
              className="secondary refresh-button"
              onClick={handleRefresh}
              disabled={!boardId || refreshing || Boolean(busyTaskId)}
            >
              {refreshing ? "Refreshing..." : "Refresh board"}
            </button>
          </div>
        </header>

        {error && (
          <div className="feedback error" role="alert">
            {error}
          </div>
        )}

      

        {boardId && (
          <form
            className="task-form"
            onSubmit={handleCreateTask}
          >
            <input
              aria-label="New task title"
              placeholder="What needs to be done?"
              value={newTask}
              onChange={(event) =>
                setNewTask(event.target.value)
              }
              maxLength={200}
              required
            />

            <button
              type="submit"
              disabled={
                loading || !sortedColumns.length
              }
            >
              {loading ? "Adding..." : "+ Add task"}
            </button>
          </form>
        )}

        {boardId && (
          <DndContext
            sensors={sensors}
            collisionDetection={boardCollisionDetection}
            onDragEnd={handleDragEnd}
          >
            <div
              className="board"
              style={{
                gridTemplateColumns:
                  `repeat(${Math.max(
                    sortedColumns.length,
                    1
                  )}, minmax(230px, 1fr))`,
              }}
            >
              {sortedColumns.map((column, index) => {
                const columnTasks = tasks
                  .filter(
                    (task) =>
                      task.columnId === column.id
                  )
                  .sort(
                    (a, b) =>
                      Number(a.position) -
                      Number(b.position)
                  );

                return (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    tasks={columnTasks}
                    columnIndex={index}
                    totalColumns={sortedColumns.length}
                    onMoveTask={handleMoveTask}
                    onTaskClick={handleTaskClick}
                    busyTaskId={busyTaskId}
                  />
                );
              })}
            </div>
          </DndContext>
        )}

        {!boardId && (
          <p className="muted">
            {!organizationsLoaded
              ? "Loading your organizations..."
              : !organizationId
                ? "Select or create an organization to get started."
                : !tenantId
                  ? "Select a branch or create one if you are an organization administrator."
                  : "Select a board or create one if you have administrator access."}
          </p>
        )}
      </main>

      {selectedTask && (
        <TaskDetails
          key={`${selectedTask.id}:${selectedTask.version}`}
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={handleSaveTask}
          saving={savingTask}
          token={token}
          tenantId={tenantId}
          boardId={boardId}
        />
      )}
    </div>
  );
}