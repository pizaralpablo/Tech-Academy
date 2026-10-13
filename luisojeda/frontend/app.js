const MAX_LOGIN_ATTEMPTS = 3;
let failedLoginAttempts = 0;
let loginLocked = false;

const $ = (selector) => document.querySelector(selector);
const authModal = $("#auth-modal");

function openAuthModal() {
  authModal.hidden = false;
  document.body.style.overflow = "hidden";
  $("#login-username").focus();
}

function closeAuthModal() {
  authModal.hidden = true;
  document.body.style.overflow = "";
  $("#open-auth").focus();
}

$("#open-auth").addEventListener("click", openAuthModal);
$("#close-auth").addEventListener("click", closeAuthModal);
authModal.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuthModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !authModal.hidden) closeAuthModal();
});

function showMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `form-message ${type}`.trim();
}

function passwordIsStrong(password) {
  return password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function postAuth(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let body = {};
  try { body = await response.json(); } catch (_) { /* API may return no body. */ }
  if (!response.ok) {
    const error = new Error(body.message || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return body;
}

document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const selected = tab.dataset.authTab;
    document.querySelectorAll("[data-auth-tab]").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
      const active = panel.dataset.authPanel === selected;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  });
});

$("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#register-message");
  const data = formData(form);

  if (!data.username || data.username.length < 3) {
    showMessage(message, "Choose a username with at least 3 characters.", "error");
    return;
  }
  if (!passwordIsStrong(data.password)) {
    showMessage(message, "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.", "error");
    return;
  }
  if (data.password !== data.passwordConfirm) {
    showMessage(message, "The passwords do not match.", "error");
    return;
  }

  try {
    await postAuth("/api/auth/register", { username: data.username, password: data.password });
    form.reset();
    showMessage(message, "Account created. You can sign in now.", "success");
  } catch (error) {
    showMessage(message, error.status === 409 ? "That username is already in use." : error.message, "error");
  }
});

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#login-message");
  if (loginLocked) return;
  const data = formData(form);

  if (!data.username || !data.password) {
    showMessage(message, "Enter your username and password.", "error");
    return;
  }

  try {
    const body = await postAuth("/api/auth/login", { username: data.username, password: data.password });
    failedLoginAttempts = 0;
    form.reset();
    sessionStorage.setItem("authToken", body.token);
    showMessage(message, "Signed in successfully. Opening your account page…", "success");
    window.setTimeout(() => { window.location.href = "/users.html"; }, 350);
  } catch (error) {
    failedLoginAttempts += 1;
    const remaining = MAX_LOGIN_ATTEMPTS - failedLoginAttempts;
    if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS || error.status === 423) {
      loginLocked = true;
      form.querySelectorAll("input, button").forEach((control) => { control.disabled = true; });
      showMessage(message, "Account temporarily locked after 3 failed attempts. Try again later.", "error");
    } else {
      showMessage(message, `${error.message} ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`, "error");
    }
  }
});
