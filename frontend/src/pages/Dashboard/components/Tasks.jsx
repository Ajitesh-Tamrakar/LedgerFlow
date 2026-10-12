import { useState } from "react";
import Card from "../../../components/Card/Card";
import "./Tasks.css";

/*
 * "Tasks" -- the one card that writes back.
 *
 * The card owns the composer's presentation (open/closed, draft text,
 * Enter/Esc) and hands *actions* to the page: onAdd(title) and
 * onToggle(task). The page does the API calls and hands the updated
 * list back as `tasks`.
 */
function Tasks({ tasks, onAdd, onToggle }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const doneCount = tasks.filter((task) => task.is_done).length;
  const hasDraft = draft.trim().length > 0;

  function submit() {
    const title = draft.trim();
    if (!title) {
      return;
    }
    onAdd(title);
    setDraft("");
    setAdding(false);
  }

  function closeComposer() {
    setAdding(false);
    setDraft("");
  }

  function handleDraftKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
    if (event.key === "Escape") {
      closeComposer();
    }
  }

  return (
    <Card className="tasks">
      <div className="tasks__header">
        <h2 className="tasks__title">Tasks</h2>
        <span className="tasks__count">
          {doneCount} of {tasks.length} done
        </span>
      </div>

      <div className="tasks__list">
        {tasks.map((task) => (
          <button
            type="button"
            className="tasks__row"
            key={task.id}
            aria-pressed={task.is_done}
            onClick={() => onToggle(task)}
          >
            <span className="tasks__box" aria-hidden="true">
              {task.is_done ? "✓" : ""}
            </span>
            <span className="tasks__text">{task.title}</span>
          </button>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="tasks__empty">
          Nothing on the list. Add the calls and filings you don’t want to
          forget.
        </div>
      )}

      <div className="tasks__composer">
        {adding ? (
          <>
            <div className="tasks__field">
              <input
                type="text"
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                aria-label="New task"
                placeholder="What needs doing?"
              />
              <button
                type="button"
                className="tasks__add"
                disabled={!hasDraft}
                onClick={submit}
              >
                Add
              </button>
            </div>
            <div className="tasks__composer-hint">
              <span>Enter to save · Esc to cancel</span>
              <button type="button" className="tasks__cancel" onClick={closeComposer}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="tasks__open"
            onClick={() => setAdding(true)}
          >
            + Add a task
          </button>
        )}
      </div>
    </Card>
  );
}

export default Tasks;
