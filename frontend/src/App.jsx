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
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("");

  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState("");

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
  const [notice, setNotice] = useState("");

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

  const loadBoardData = useCallback(
    async (selectedTenantId, selectedBoardId, showNotice = false) => {
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

        if (showNotice) {
          setNotice("Board refreshed successfully.");
        }

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
    if (!token) return;

    let cancelled = false;

    async function fetchOrganizations() {
      try {
        const data = await request("/api/organizations");

        if (cancelled) return;

        const items = extractList(data, "organizations");
        setOrganizations(items);
        setOrganizationId(items[0]?.id || "");
      } catch (err) {
        if (!cancelled) setError(err.message);
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

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setNotice("");
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
    setNotice("");

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
      setNotice(
        refreshed
          ? `Task movement ${direction === "undo" ? "undone" : "redone"} successfully.`
          : "Movement saved, but board refresh failed."
      );
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
    setNotice("");
  }

  function handleOrganizationChange(event) {
    boardRequestRef.current += 1;

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
    setNotice("");
  }

  function handleTenantChange(event) {
    boardRequestRef.current += 1;

    setTenantId(event.target.value);
    setBoards([]);
    setBoardId("");
    setColumns([]);
    setTasks([]);
    setSelectedTask(null);
    clearMovementHistory();
    setError("");
    setNotice("");
  }

  function handleBoardChange(event) {
    boardRequestRef.current += 1;

    setBoardId(event.target.value);
    setColumns([]);
    setTasks([]);
    setSelectedTask(null);
    clearMovementHistory();
    setError("");
    setNotice("");
  }

  async function handleRefresh() {
    if (!tenantId || !boardId || refreshing) return;

    setNotice("");
    await loadBoardData(tenantId, boardId, true);
  }

  async function handleCreateTask(event) {
    event.preventDefault();

    const title = newTask.trim();

    if (!title || !boardId || !sortedColumns.length) {
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

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

      const success = await loadBoardData(tenantId, boardId);

      if (success) {
        setNotice("Task created successfully.");
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
    setNotice("");

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
      const success = await loadBoardData(tenantId, boardId);

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
        } else {
          setNotice("Task moved. Undo is unavailable for this movement.");
        }
      } catch (historyError) {
        console.warn("Unable to load movement activity:", historyError);
        setNotice("Task moved. Unable to load Undo history.");
      }

      if (success) {
        
        setNotice((previous) => previous || "Task moved successfully.");
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
    setNotice("");
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
    setNotice("");

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

      const success = await loadBoardData(tenantId, boardId);

      if (success) {
        setNotice("Task updated successfully.");
      } else {
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
        <form className="login-card" onSubmit={handleLogin}>
          <h1>Kanban</h1>
          <p>Sign in to your workspace</p>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
          />

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
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

        {notice && !error && (
          <div className="feedback success" role="status">
            {notice}
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
            Select an organization, branch, and board to continue.
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