import { apiRequest } from "./auth";

/*
 * Plain CRUD on the tasks/ viewset. The dashboard's Tasks card
 * lists them, adds new ones and flips is_done on a click.
 */

// All tasks, newest first (paginated).
export async function getTasks() {
    return apiRequest("/tasks/");
}


// Add a task.
export async function addTask(title) {
    return apiRequest("/tasks/", {
        method: "POST",
        body: JSON.stringify({ title }),
    });
}


// Update one task (e.g. { is_done: true }, or a new title).
export async function updateTask(id, data) {
    return apiRequest(`/tasks/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}
