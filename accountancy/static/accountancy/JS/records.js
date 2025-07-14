// records_ui.js — Only handles UI effects (no data)
document.addEventListener("DOMContentLoaded", () => {
  // ========== Modal Overlay ========== //
  const modalOverlay = document.getElementById("modal-overlay")
  const modals = document.querySelectorAll(".modal")
  const actionButtons = document.querySelectorAll(".action-btn")
  const closeButtons = document.querySelectorAll(".modal-close")

  function showModal(modalId) {
    modals.forEach((modal) => (modal.style.display = "none"))
    const target = document.getElementById(`${modalId}-modal`)
    if (target) {
      modalOverlay.classList.remove("hidden")
      target.style.display = "block"
      document.body.style.overflow = "hidden"
    }
  }

  function hideModal() {
    modalOverlay.classList.add("hidden")
    modals.forEach((modal) => (modal.style.display = "none"))
    document.body.style.overflow = "auto"
  }

  actionButtons.forEach((btn) => {
    btn.addEventListener("click", () => showModal(btn.dataset.modal))
  })

  closeButtons.forEach((btn) => btn.addEventListener("click", hideModal))
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) hideModal()
  })

  // ========== Lightbox ========== //
  const lightbox = document.getElementById("lightbox")
  const lightboxImg = document.getElementById("lightbox-image")
  const lightboxClose = document.querySelector(".lightbox-close")

  window.openLightbox = (imgSrc) => {
    if (lightbox && lightboxImg) {
      lightboxImg.src = imgSrc
      lightbox.classList.remove("hidden")
      document.body.style.overflow = "hidden"
    }
  }

  function closeLightbox() {
    lightbox?.classList.add("hidden")
    document.body.style.overflow = "auto"
  }

  lightboxClose?.addEventListener("click", closeLightbox)
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox()
  })
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox()
      hideModal()
    }
  })

  // ========== File Upload Display ========== //
  document.querySelectorAll(".file-input").forEach((input) => {
    input.addEventListener("change", function () {
      const text = this.parentElement.querySelector(".upload-text")
      text.textContent = this.files[0]?.name || "Click to upload or drag and drop"
    })
  })

  // ========== Auto-set Today Date on Inputs ========== //
  const today = new Date().toISOString().split("T")[0]
  document.getElementById("bill-date")?.setAttribute("value", today)
  document.getElementById("payment-date")?.setAttribute("value", today)

  // ========== Notification (Optional Success Message) ========== //
  window.showNotification = (msg) => {
    const box = document.getElementById("notification")
    if (box) {
      const msgEl = box.querySelector(".notification-message")
      msgEl.textContent = msg
      box.classList.remove("hidden")
      setTimeout(() => box.classList.add("hidden"), 3000)
    }
  }
})
