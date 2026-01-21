// Alternative approach: Adjust labels to match data length
console.log("graphs.js loaded successfully");

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    initializeChart();
  }, 100);
});

function initializeChart() {
  // Get and validate the data elements
  const dailyDataElement = document.getElementById('daily_data');
  const weekDataElement = document.getElementById('week_data');
  const monthDataElement = document.getElementById('month_data');
  
  if (!dailyDataElement || !weekDataElement || !monthDataElement) {
    console.error("One or more data elements not found");
    return;
  }

  // Parse the data from the correct elements
  const daily_data = JSON.parse(dailyDataElement.textContent);
  const week_data = JSON.parse(weekDataElement.textContent);
  const month_data = JSON.parse(monthDataElement.textContent);
  
  console.log("Daily data:", daily_data);
  console.log("Week data:", week_data);
  console.log("Month data:", month_data);

  const ctx = document.getElementById("sales-chart");
  if (!ctx) {
    console.error("Chart canvas with ID 'sales-chart' not found");
    return;
  }

  // Create labels that match your data length
  const allLabels = {
    daily: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weekly: ["Week 1", "Week 2", "Week 3", "Week 4"],
    monthly: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
  };

  const salesData = {
    daily: {
      labels: allLabels.daily.slice(0, daily_data.length), // Only use labels needed
      data: daily_data,
    },
    weekly: {
      labels: allLabels.weekly.slice(0, week_data.length), // Only use labels needed
      data: week_data,
    },
    monthly: {
      labels: allLabels.monthly.slice(0, month_data.length), // Only use labels needed
      data: month_data,
    },
  };

  let currentView = "daily";

  // Create the chart
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: salesData[currentView].labels,
      datasets: [
        {
          label: "Sales Amount",
          data: salesData[currentView].data,
          borderColor: "rgb(251, 191, 36)",
          backgroundColor: "rgba(251, 191, 36, 0.1)",
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "rgb(251, 191, 36)",
          pointBorderColor: "#fff",
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
          titleColor: "#fff",
          bodyColor: "#fff",
          borderColor: "rgb(251, 191, 36)",
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

  // Update chart when view changes
  window.updateChart = (view) => {
    console.log("Updating chart to view:", view);
    console.log("New data:", salesData[view].data);
    console.log("New labels:", salesData[view].labels);
    
    // Update button states
    document.querySelectorAll('.chart-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    
    currentView = view;
    chart.data.labels = salesData[view].labels;
    chart.data.datasets[0].data = salesData[view].data;
    chart.update();
    
    console.log("Chart updated successfully");
  };

  // Optional: Add some debugging info
  console.log("Chart initialized with view:", currentView);
  console.log("Initial data:", salesData[currentView].data);
  console.log("Initial labels:", salesData[currentView].labels);
}