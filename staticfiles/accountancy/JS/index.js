// Home page functionality
document.addEventListener("DOMContentLoaded", () => {
  const dailyEntryBtn = document.getElementById("daily-entry-btn")
  const collectionForm = document.getElementById("collection-form")
  const transactionDate = document.getElementById("transaction-date")
  const upiAmount = document.getElementById("upi-amount")
  const cashAmount = document.getElementById("cash-amount")
  const cardsAmount = document.getElementById("cards-amount")
  const totalAmount = document.getElementById("total-amount")
  const form = document.getElementById("daily-collection-form")

  // Show collection form as modal
  dailyEntryBtn.addEventListener("click", () => {
    collectionForm.classList.remove("hidden")
    document.body.style.overflow = "hidden"

    // Set today's date
    if (!transactionDate.value) {
      const today = new Date()
      const formattedDate = today.toISOString().split("T")[0]
      transactionDate.value = formattedDate
    }

    // Focus on first input
    setTimeout(() => {
      transactionDate.focus()
    }, 100)
  })

  // Close modal function
  function closeModal() {
    collectionForm.classList.add("hidden")
    document.body.style.overflow = "auto"
    dailyEntryBtn.style.display = "inline-flex"
  }

  // Close modal when clicking outside
  collectionForm.addEventListener("click", (e) => {
    if (e.target === collectionForm) {
      closeModal()
    }
  })

  // Close modal with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !collectionForm.classList.contains("hidden")) {
      closeModal()
    }
  })

  // Calculate total amount
  function calculateTotal() {
    const upi = Number.parseFloat(upiAmount.value) || 0
    const cash = Number.parseFloat(cashAmount.value) || 0
    const cards = Number.parseFloat(cardsAmount.value) || 0
    const total = upi + cash + cards

    totalAmount.textContent = "₹" + total.toLocaleString()
  }

  // Add event listeners for amount inputs
  upiAmount.addEventListener("input", calculateTotal)
  cashAmount.addEventListener("input", calculateTotal)
  cardsAmount.addEventListener("input", calculateTotal)

})
