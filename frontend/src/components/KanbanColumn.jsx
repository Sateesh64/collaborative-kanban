import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import TaskCard from "./TaskCard";

export default function KanbanColumn({
  column,
  tasks = [],
  columnIndex,
  totalColumns,
  onMoveTask,
  onTaskClick,
  busyTaskId,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: {
      type: "column",
      columnId: column.id,
    },
  });

  const sortedTasks = [...tasks].sort(
    (a, b) => Number(a.position || 0) - Number(b.position || 0)
  );

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column ${isOver ? "column-over" : ""}`}
    >
      <div className="column-heading">
        <h3>{column.name}</h3>
        <span>{sortedTasks.length}</span>
      </div>

      <SortableContext
        items={sortedTasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="column-tasks">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onMove={onMoveTask}
              canPrevious={columnIndex > 0}
              canNext={columnIndex < totalColumns - 1}
              disabled={busyTaskId === task.id}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
