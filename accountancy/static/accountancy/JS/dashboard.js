// JBB/accountancy/static/accountancy/js/dashboard.js

// Dashboard functionality
document.addEventListener("DOMContentLoaded", () => {
  
  // Get data elements
  const dailyDataElement = document.getElementById('daily_data');
  const weekDataElement = document.getElementById('week_data');
  const monthDataElement = document.getElementById('month_data');
  
  // Check if elements exist
  if (!dailyDataElement || !weekDataElement || !monthDataElement) {
    return;
  }
  
  // Parse data from correct elements
  const daily_data = JSON.parse(dailyDataElement.textContent);
  const week_data = JSON.parse(weekDataElement.textContent);
  const month_data = JSON.parse(monthDataElement.textContent);
  
  // Chart data
  const chartData = {
    daily: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      data: daily_data,
    },
    weekly: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      data: week_data,
    },
    monthly: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      data: month_data,
    },
  };

  // Initialize chart
  const ctx = document.getElementById("sales-chart");
  let currentChart = null; // Store chart instance
  
  // Check if ctx exists before trying to create a chart
  if (ctx) {
    // Create initial chart
    currentChart = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: {
        labels: chartData.daily.labels,
        datasets: [
          {
            label: "Sales Amount",
            data: chartData.daily.data,
            borderColor: "#fbbf24",
            backgroundColor: "rgba(251, 191, 36, 0.1)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#fbbf24",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            titleColor: "#ffffff",
            bodyColor: "#ffffff",
            borderColor: "#fbbf24",
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context) => "₹" + context.parsed.y.toLocaleString(),
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(0, 0, 0, 0.1)",
            },
            ticks: {
              callback: (value) => "₹" + value / 1000 + "K",
            },
          },
          x: {
            grid: {
              display: false,
            },
          },
        },
        interaction: {
          intersect: false,
          mode: "index",
        },
      },
    });

    // Chart view buttons
    const chartButtons = document.querySelectorAll(".chart-btn");

    chartButtons.forEach((button, index) => {
      button.addEventListener("click", function (event) {
        // Remove active class from all buttons
        chartButtons.forEach((btn) => {
          btn.classList.remove("active");
        });

        // Add active class to clicked button
        this.classList.add("active");

        // Get the view type
        const view = this.dataset.view;

        // Check if view exists in chartData
        if (chartData[view]) {
          // Update chart data - this is the correct way to update Chart.js
          currentChart.data.labels = chartData[view].labels;
          currentChart.data.datasets[0].data = chartData[view].data;
          currentChart.update('active');
        }
      });
    });
  }

  // Tasks functionality
  let tasks = [];
  let tasksLoaded = false; // Add flag to track if tasks are loaded
  
  // Get DOM elements
  const addTaskBtn = document.getElementById("add-task-btn");
  const addTaskForm = document.getElementById("add-task-form");
  const newTaskInput = document.getElementById("new-task-input");
  const saveTaskBtn = document.getElementById("save-task-btn");
  const tasksList = document.getElementById("tasks-list");

  // Check if task elements exist before adding listeners
  if (!addTaskBtn || !addTaskForm || !newTaskInput || !saveTaskBtn || !tasksList) {
    return; // Exit if essential elements are missing
  }

  // CSRF token utility
  function getCSRFToken() {
    let cookieValue = null;
    const name = 'csrftoken';
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + '=')) {
          cookieValue = decodeURIComponent(cookie.slice(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  // API helper functions
  async function apiCall(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(),
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      showNotification('Operation failed. Please try again.', 'error');
      throw error;
    }
  }

  // Load tasks from server
  async function loadTasks() {
    try {
      const data = await apiCall('/task-list', { method: 'GET' });
      
      tasks = data.taskList.map(task => ({
        id: task.id,
        text: task.task,
        completed: task.task_status,
      }));

      tasksLoaded = true; // Mark tasks as loaded
      renderTasks();
    } catch (error) {
      console.error('Failed to load tasks:', error);
      showNotification('Failed to load tasks', 'error');
    }
  }

  // Add new task
  async function addTask() {
    const taskText = newTaskInput.value.trim();
    if (!taskText) {
      showNotification('Please enter a task', 'error');
      return;
    }

    try {
      // Show loading state
      saveTaskBtn.disabled = true;
      saveTaskBtn.textContent = 'Adding...';

      const data = await apiCall('/task-list', {
        method: 'POST',
        body: JSON.stringify({ task: taskText })
      });

      // Add task to local array with real DB ID
      const newTask = {
        id: data.id,
        text: taskText,
        completed: false,
      };
      
      tasks.push(newTask);
      newTaskInput.value = "";
      addTaskForm.classList.add("hidden");
      renderTasks();
      showNotification("Task added successfully!", 'success');

    } catch (error) {
      console.error('Failed to add task:', error);
    } finally {
      // Reset button state
      saveTaskBtn.disabled = false;
      saveTaskBtn.textContent = 'Save Task';
    }
  }

  // Toggle task completion
  async function toggleTask(taskId) {
    // Don't allow toggling if tasks aren't loaded yet
    if (!tasksLoaded) {
      showNotification('Please wait for tasks to load', 'error');
      return;
    }

    try {
      await apiCall('/task-list', {
        method: 'PATCH',
        body: JSON.stringify({
          task_action: 'update_status',
          id: taskId
        })
      });

      // Update local task
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        task.completed = !task.completed;
        renderTasks();
        showNotification('Task updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
      // Revert UI change by re-rendering
      renderTasks();
    }
  }

  // Delete task - REMOVED CONFIRMATION DIALOG
  async function deleteTask(taskId) {
    try {
      await apiCall('/task-list', {
        method: 'DELETE',
        body: JSON.stringify({ id: taskId })
      });

      // Remove from local array
      const taskIndex = tasks.findIndex((t) => t.id === taskId);
      if (taskIndex > -1) {
        tasks.splice(taskIndex, 1);
        renderTasks();
        showNotification("Task deleted successfully!", 'success');
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }

  // Edit task
  function editTask(taskId) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    const taskText = taskElement.querySelector('.task-text');
    const taskInput = taskElement.querySelector('.task-edit-input');
    
    if (taskText && taskInput) {
      taskText.classList.add('hidden');
      taskInput.classList.remove('hidden');
      taskInput.focus();
      taskInput.select();
    }
  }

  // Save task edit
  async function saveTaskEdit(taskId, newText) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    const taskText = taskElement.querySelector('.task-text');
    const taskInput = taskElement.querySelector('.task-edit-input');
    
    // Hide input and show text regardless of success/failure
    taskInput.classList.add('hidden');
    taskText.classList.remove('hidden');

    if (!newText || !newText.trim()) {
      showNotification('Task cannot be empty', 'error');
      return;
    }

    const trimmedText = newText.trim();
    
    try {
      await apiCall('/task-list', {
        method: 'PATCH',
        body: JSON.stringify({
          task_action: 'update_task',
          id: taskId,
          task: trimmedText
        })
      });

      // Update local task
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        task.text = trimmedText;
        taskText.textContent = trimmedText;
        showNotification("Task updated successfully!", 'success');
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      // Revert input value
      taskInput.value = taskText.textContent;
    }
  }

  // Handle keypress in edit input
  function handleTaskEditKeypress(event, taskId, newText) {
    if (event.key === "Enter") {
      event.preventDefault();
      saveTaskEdit(taskId, newText);
    } else if (event.key === "Escape") {
      event.preventDefault();
      const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
      if (!taskElement) return;

      const taskText = taskElement.querySelector('.task-text');
      const taskInput = taskElement.querySelector('.task-edit-input');
      
      // Reset input value and hide
      taskInput.value = taskText.textContent;
      taskInput.classList.add('hidden');
      taskText.classList.remove('hidden');
    }
  }

  // Render tasks
  function renderTasks() {
    tasksList.innerHTML = "";

    if (tasks.length === 0) {
      tasksList.innerHTML = '<p class="no-tasks">No tasks yet. Add your first task!</p>';
      return;
    }

    tasks.forEach((task) => {
      const taskElement = document.createElement("div");
      taskElement.className = `task-item ${task.completed ? "completed" : ""}`;
      taskElement.setAttribute('data-task-id', task.id);

      // Escape HTML to prevent XSS
      const escapedText = task.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      taskElement.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""}
               onchange="window.toggleTask(${task.id})">
        <div class="task-content">
            <p class="task-text" onclick="window.editTask(${task.id})" 
               style="${task.completed ? 'text-decoration: line-through; opacity: 0.7;' : ''}">${escapedText}</p>
            <input type="text" class="task-edit-input hidden" value="${escapedText}" 
                   onblur="window.saveTaskEdit(${task.id}, this.value)" 
                   onkeypress="window.handleTaskEditKeypress(event, ${task.id}, this.value)">
        </div>
        <div class="task-actions">
            <button class="task-action-btn edit" onclick="window.editTask(${task.id})" title="Edit task">✏️</button>
            <button class="task-action-btn delete" onclick="window.deleteTask(${task.id})" title="Delete task">🗑️</button>
        </div>
      `;

      tasksList.appendChild(taskElement);
    });
  }

  // Show/hide add task form
  addTaskBtn.addEventListener("click", () => {
    addTaskForm.classList.toggle("hidden");
    if (!addTaskForm.classList.contains("hidden")) {
      newTaskInput.focus();
    }
  });

  // Event listeners
  saveTaskBtn.addEventListener("click", addTask);

  newTaskInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  });

  // Make functions available globally for inline event handlers
  window.toggleTask = toggleTask;
  window.deleteTask = deleteTask;
  window.editTask = editTask;
  window.saveTaskEdit = saveTaskEdit;
  window.handleTaskEditKeypress = handleTaskEditKeypress;

  // Notification function
  function showNotification(message, type = 'info') {
    const notification = document.getElementById("notification");
    const messageElement = notification?.querySelector(".notification-message");

    if (notification && messageElement) {
      messageElement.textContent = message;
      notification.className = `notification ${type}`;
      notification.classList.remove("hidden");

      setTimeout(() => {
        notification.classList.add("hidden");
      }, 3000);
    }
  }

  // Initialize tasks
  loadTasks();
  
});