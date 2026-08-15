/**
 * OneDayMataram - Form Handler & 2-Step OTP Authorization
 * Connects join.html and contact.html to MyLeader.app EC2 Node Backend API
 */

// Configuration
const CONFIG = {
  // API_BASE_URL: "http://localhost:5000/api/v1/onedaymataram",
  API_BASE_URL: "https://api.hashgang.com/api/v1/onedaymataram",
  OTP_EXPIRE_SECONDS: 60,
};

// Global state for active form submission
let currentSubmission = {
  formType: null, // 'join' or 'contact'
  email: "",
  formData: {},
  formElement: null,
  submitBtn: null,
  resendTimerInterval: null,
};

// Initialize Toast Container
function getOrCreateToastContainer() {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

// Show Custom Toast Notification
function showToast(message, type = "success", duration = 4000) {
  const container = getOrCreateToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconClass = "fa-check-circle";
  if (type === "error") iconClass = "fa-exclamation-circle";
  if (type === "info") iconClass = "fa-info-circle";

  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }, duration);
}

// Get or Create OTP Modal Overlay
function getOrCreateOTPModal() {
  let modal = document.getElementById("otpModalOverlay");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "otpModalOverlay";
    modal.className = "otp-modal-overlay";
    modal.innerHTML = `
      <div class="otp-modal-card">
        <button type="button" class="otp-modal-close" id="closeOtpModal">&times;</button>
        <div class="otp-modal-icon">
          <i class="fas fa-envelope-open-text"></i>
        </div>
        <h3>Verify Email Address</h3>
        <p>We've sent a 6-digit OTP code to <br><span class="user-email-target" id="otpTargetEmail">user@example.com</span></p>

        <div class="otp-input-wrapper">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="0" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="1" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="2" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="3" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="4" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
          <input type="text" maxlength="1" class="otp-digit-input" data-index="5" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
        </div>

        <button type="button" class="btn primary-btn full-btn" id="verifyOtpBtn">
          Verify & Submit
        </button>

        <div class="otp-resend-wrapper">
          Didn't receive code? <button type="button" class="otp-resend-btn" id="resendOtpBtn" disabled>Resend in <span id="resendCountdown">60</span>s</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event Listeners inside modal
    document.getElementById("closeOtpModal").addEventListener("click", hideOTPModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideOTPModal();
    });

    document.getElementById("verifyOtpBtn").addEventListener("click", handleOTPVerifySubmit);
    document.getElementById("resendOtpBtn").addEventListener("click", handleResendOTP);

    setupOTPInputsNavigation();
  }
  return modal;
}

// Auto focus movement across 6 digit input boxes
function setupOTPInputsNavigation() {
  const inputs = document.querySelectorAll(".otp-digit-input");
  inputs.forEach((input, index) => {
    input.addEventListener("input", (e) => {
      const value = e.target.value;
      if (value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });

    // Handle paste event (e.g., user pastes 6 digits)
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData("text").trim();
      if (/^\d{6}$/.test(pasteData)) {
        pasteData.split("").forEach((char, i) => {
          if (inputs[i]) inputs[i].value = char;
        });
        inputs[inputs.length - 1].focus();
      }
    });
  });
}

// Show Modal & Start Timer
function showOTPModal(email) {
  const modal = getOrCreateOTPModal();
  document.getElementById("otpTargetEmail").innerText = email;

  // Clear previous OTP inputs
  const inputs = document.querySelectorAll(".otp-digit-input");
  inputs.forEach((input) => (input.value = ""));

  modal.classList.add("active");
  setTimeout(() => inputs[0].focus(), 150);

  startResendTimer();
}

// Hide Modal
function hideOTPModal() {
  const modal = document.getElementById("otpModalOverlay");
  if (modal) {
    modal.classList.remove("active");
  }
  if (currentSubmission.resendTimerInterval) {
    clearInterval(currentSubmission.resendTimerInterval);
  }
}

// Start 60s Resend Timer
function startResendTimer() {
  const resendBtn = document.getElementById("resendOtpBtn");
  const countdownSpan = document.getElementById("resendCountdown");
  let timeLeft = CONFIG.OTP_EXPIRE_SECONDS;

  resendBtn.disabled = true;
  countdownSpan.innerText = timeLeft;
  resendBtn.childNodes[0].nodeValue = "Resend in ";

  if (currentSubmission.resendTimerInterval) {
    clearInterval(currentSubmission.resendTimerInterval);
  }

  currentSubmission.resendTimerInterval = setInterval(() => {
    timeLeft--;
    countdownSpan.innerText = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(currentSubmission.resendTimerInterval);
      resendBtn.disabled = false;
      resendBtn.innerHTML = "Resend OTP";
    }
  }, 1000);
}

// Handle Form Submission (Step 1: Request OTP)
async function handleFormSubmit(event, formType) {
  event.preventDefault();
  const formElement = event.target;
  const submitBtn = formElement.querySelector('button[type="submit"]');

  // Extract Form Data
  const formData = {};
  const inputs = formElement.querySelectorAll("input, textarea, select");
  inputs.forEach((field) => {
    if (field.name || field.id || field.placeholder) {
      const key = field.name || field.id || field.placeholder.toLowerCase().replace(/[^a-z0-9]/g, "");
      formData[key] = field.value.trim();
    }
  });

  // Strict Email Regex requiring name@domain.tld (e.g. user@example.com)
  const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Extract Email
  const emailInput = formElement.querySelector('input[type="email"]');
  const email = emailInput ? emailInput.value.trim() : "";

  if (emailInput) {
    if (!email || !STRICT_EMAIL_REGEX.test(email.toLowerCase())) {
      emailInput.setCustomValidity("Please enter a valid email address with a domain (e.g. name@example.com).");
    } else {
      emailInput.setCustomValidity("");
    }
  }

  // Trigger HTML5 built-in validation for required fields
  if (!formElement.checkValidity()) {
    formElement.reportValidity();
    showToast("Please enter a valid email address (e.g. name@example.com).", "error");
    if (emailInput) emailInput.focus();
    return;
  }

  // Set current submission context
  currentSubmission.formType = formType;
  currentSubmission.email = email;
  currentSubmission.formData = formData;
  currentSubmission.formElement = formElement;
  currentSubmission.submitBtn = submitBtn;

  // Set Loading state
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="btn-spinner"></span> Sending OTP...`;

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, formType }),
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok && result.success !== false) {
      showToast("OTP sent to your email address!", "info");
      showOTPModal(email);
    } else {
      // Fallback message or API error
      const errorMsg = result.message || "Failed to send OTP. Please check backend connection.";
      showToast(errorMsg, "error");

      // For local testing demonstration if API is not active yet:
      // showToast("API Offline Demo: Simulating OTP sent to " + email, "info");
      // showOTPModal(email);
    }
  } catch (error) {
    console.warn("Backend API not reachable yet. API URL:", CONFIG.API_BASE_URL, error);
    showToast("Could not connect to API server. Please try again later.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

// Handle Resend OTP Click
async function handleResendOTP() {
  if (!currentSubmission.email) return;

  const resendBtn = document.getElementById("resendOtpBtn");
  resendBtn.disabled = true;
  resendBtn.innerText = "Sending...";

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentSubmission.email,
        formType: currentSubmission.formType,
      }),
    });

    if (response.ok) {
      showToast("A new OTP has been sent to your email.", "info");
    } else {
      showToast("Failed to resend OTP. Please try again.", "error");
    }
  } catch (err) {
    showToast("OTP resend request failed.", "error");
  }

  startResendTimer();
}

// Handle OTP Verification & Submission (Step 2: Verify & Submit)
async function handleOTPVerifySubmit() {
  const inputs = document.querySelectorAll(".otp-digit-input");
  let otp = "";
  inputs.forEach((input) => (otp += input.value.trim()));

  if (otp.length < 6) {
    showToast("Please enter all 6 digits of the OTP.", "error");
    return;
  }

  const verifyBtn = document.getElementById("verifyOtpBtn");
  const originalBtnText = verifyBtn.innerHTML;
  verifyBtn.disabled = true;
  verifyBtn.innerHTML = `<span class="btn-spinner"></span> Verifying...`;

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/verify-and-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentSubmission.email,
        otp: otp,
        formType: currentSubmission.formType,
        formData: currentSubmission.formData,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok && result.success !== false) {
      hideOTPModal();
      showToast("Verification successful! Your response has been submitted.", "success", 5000);
      if (currentSubmission.formElement) {
        currentSubmission.formElement.reset();
      }
    } else {
      const errorMsg = result.message || "Invalid or expired OTP code. Please try again.";
      showToast(errorMsg, "error");
    }
  } catch (error) {
    console.error("API error:", error);
    showToast("Network error during verification. Please try again.", "error");
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = originalBtnText;
  }
}

// Attach Event Listeners on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Real-time email input validation
  document.querySelectorAll('input[type="email"]').forEach((inputEl) => {
    const validate = () => {
      const val = inputEl.value.trim();
      if (val && !STRICT_EMAIL_REGEX.test(val.toLowerCase())) {
        inputEl.setCustomValidity("Please enter a valid email address with a domain (e.g. name@example.com).");
      } else {
        inputEl.setCustomValidity("");
      }
    };
    inputEl.addEventListener("input", validate);
    inputEl.addEventListener("blur", validate);
  });

  // Join Form
  const joinForm = document.querySelector(".join-form") || document.getElementById("joinForm");
  if (joinForm) {
    joinForm.addEventListener("submit", (e) => handleFormSubmit(e, "join"));
  }

  // Contact Form
  const contactForm = document.querySelector(".contact-form") || document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => handleFormSubmit(e, "contact"));
  }
});
