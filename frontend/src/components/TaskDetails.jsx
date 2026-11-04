import { useEffect, useState } from "react";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/api\/?$/, "");

function getActivityLabel(action) {
  const labels = {
    TASK_CREATED: "Task created",
    TASK_UPDATED: "Task updated",
    TASK_MOVED: "Task moved",
    TASK_DELETED: "Task deleted",
  };

  return (
    labels[action] ||
    action?.replaceAll("_", " ").toLowerCase() ||
    "Activity recorded"
  );
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

export default function TaskDetails({
  task,
  onClose,
  onSave,
  saving = false,
  token,
  tenantId,
  boardId,
}) {
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(
    task.description || ""
  );
  const [priority, setPriority] = useState(
    task.priority || "MEDIUM"
  );
  const [error, setError] = useState("");

  const [activities, setActivities] = useState([]);
  const [loadingActivity, setLoadingActivity] =
    useState(false);
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    if (!token || !tenantId || !boardId || !task.id) {
      return;
    }

    const controller = new AbortController();

    async function loadActivity() {
      setLoadingActivity(true);

      try {
        const url =
          `${API_URL}/api/tenants/${tenantId}` +
          `/boards/${boardId}/tasks/${task.id}/activity`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || "Unable to load activity."
          );
        }

        if (controller.signal.aborted) return;

        const records = Array.isArray(result)
          ? result
          : result.activities ||
            result.activityLogs ||
            result.logs ||
            [];

        setActivities(
          [...records].sort(
            (a, b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          )
        );
        setActivityError("");
      } catch (err) {
        if (controller.signal.aborted) return;

        setActivityError(
          err.message || "Unable to load activity."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingActivity(false);
        }
      }
    }

    loadActivity();

    return () => controller.abort();
  }, [token, tenantId, boardId, task.id]);

  async function refreshActivity() {
    if (!token || !tenantId || !boardId) return;

    setLoadingActivity(true);
    setActivityError("");

    try {
      const url =
        `${API_URL}/api/tenants/${tenantId}` +
        `/boards/${boardId}/tasks/${task.id}/activity`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to load activity."
        );
      }

      const records = Array.isArray(result)
        ? result
        : result.activities ||
          result.activityLogs ||
          result.logs ||
          [];

      setActivities(
        [...records].sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
      );
    } catch (err) {
      setActivityError(
        err.message || "Unable to load activity."
      );
    } finally {
      setLoadingActivity(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    const cleanTitle = title.trim();

    if (!cleanTitle || cleanTitle.length > 200) {
      setError(
        "Title must contain between 1 and 200 characters."
      );
      return;
    }

    if (description.length > 5000) {
      setError(
        "Description must not exceed 5000 characters."
      );
      return;
    }

    try {
      await onSave({
        taskId: task.id,
        title: cleanTitle,
        description,
        priority,
        version: task.version,
      });
    } catch (err) {
      setError(
        err.message || "Unable to save task."
      );
    }
  }

  const fieldStyle = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #dedede",
    borderRadius: 8,
    background: "#fff",
    color: "#111",
    font: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block",
    marginBottom: 7,
    fontWeight: 600,
    fontSize: 13,
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.28)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-details-title"
        style={{
          width: "min(440px, 100vw)",
          height: "100%",
          boxSizing: "border-box",
          overflowY: "auto",
          padding: 28,
          background: "#fff",
          boxShadow:
            "-6px 0 30px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 26,
          }}
        >
          <h2
            id="task-details-title"
            style={{
              margin: 0,
              fontSize: 22,
            }}
          >
            Task details
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close task details"
            style={{
              ...fieldStyle,
              width: "auto",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 22 }}>
            <label
              htmlFor="task-title"
              style={labelStyle}
            >
              Title
            </label>

            <input
              id="task-title"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              maxLength={200}
              required
              disabled={saving}
              style={fieldStyle}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label
              htmlFor="task-description"
              style={labelStyle}
            >
              Description
            </label>

            <textarea
              id="task-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              maxLength={5000}
              rows={6}
              disabled={saving}
              style={{
                ...fieldStyle,
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label
              htmlFor="task-priority"
              style={labelStyle}
            >
              Priority
            </label>

            <select
              id="task-priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value)
              }
              disabled={saving}
              style={fieldStyle}
            >
              {priorities.map((value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                color: "#b42318",
                fontSize: 13,
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 28,
            }}
          >
            <button
              type="submit"
              disabled={saving}
              style={{
                ...fieldStyle,
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                flex: 1,
              }}
            >
              {saving
                ? "Saving..."
                : "Save changes"}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                ...fieldStyle,
                width: "auto",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>

        <div
          style={{
            borderTop: "1px solid #e5e5e5",
            marginTop: 32,
            paddingTop: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 17,
              }}
            >
              Activity history
            </h3>

            <button
              type="button"
              onClick={refreshActivity}
              disabled={loadingActivity}
              style={{
                ...fieldStyle,
                width: "auto",
                padding: "7px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {loadingActivity
                ? "Loading..."
                : "Refresh"}
            </button>
          </div>

          {activityError && (
            <p
              role="alert"
              style={{
                color: "#b42318",
                fontSize: 13,
              }}
            >
              {activityError}
            </p>
          )}

          {loadingActivity && (
            <p
              style={{
                color: "#777",
                fontSize: 13,
              }}
            >
              Loading activity...
            </p>
          )}

          {!loadingActivity &&
            !activityError &&
            activities.length === 0 && (
              <p
                style={{
                  color: "#777",
                  fontSize: 13,
                }}
              >
                No activity recorded yet.
              </p>
            )}

          {!loadingActivity &&
            activities.map((activity) => (
              <div
                key={activity.id}
                style={{
                  borderLeft:
                    "2px solid #e5e5e5",
                  paddingLeft: 16,
                  marginBottom: 22,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  {getActivityLabel(
                    activity.action
                  )}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#777",
                    marginTop: 5,
                  }}
                >
                  {formatDate(
                    activity.createdAt
                  )}
                </div>

                {activity.details &&
                  typeof activity.details ===
                    "object" &&
                  (activity.details.fromColumn ||
                    activity.details.toColumn) && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#555",
                        marginTop: 7,
                      }}
                    >
                      {activity.details.fromColumn ||
                        "Previous column"}
                      {" → "}
                      {activity.details.toColumn ||
                        "New column"}
                    </div>
                  )}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
