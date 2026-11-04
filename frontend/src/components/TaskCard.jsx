import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function TaskCard({
  task,
  onClick,
  onMove,
  canPrevious = false,
  canNext = false,
  disabled = false,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
    },
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  function openDetails() {
    if (!disabled && onClick) {
      onClick(task);
    }
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? "task-dragging" : ""}`}
    >
      <div className="task-card-top">
        <span className="priority">
          {task.priority || "MEDIUM"}
        </span>

        <button
          type="button"
          className="drag-handle"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`Drag ${task.title}`}
          title="Drag task"
        >
          ⠿
        </button>
      </div>

      <div
        className="task-card-content"
        onClick={openDetails}
        onKeyDown={(event) => {
          if (
            !disabled &&
            onClick &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            openDetails();
          }
        }}
        role={onClick ? "button" : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
        aria-label={
          onClick ? `View details for ${task.title}` : undefined
        }
        style={{
          cursor: onClick && !disabled ? "pointer" : "default",
        }}
      >
        <h4>{task.title}</h4>

        {task.description && (
          <p>{task.description}</p>
        )}
      </div>

      <div className="task-actions">
        {canPrevious && (
          <button
            type="button"
            className="secondary"
            disabled={disabled}
            onClick={() => onMove?.(task, -1)}
          >
            ← Previous
          </button>
        )}

        {canNext && (
          <button
            type="button"
            className="secondary"
            disabled={disabled}
            onClick={() => onMove?.(task, 1)}
          >
            Next →
          </button>
        )}
      </div>
    </article>
  );
}
