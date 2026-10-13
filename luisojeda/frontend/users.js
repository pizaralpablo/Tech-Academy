const token = sessionStorage.getItem("authToken");
const message = document.querySelector("#users-message");
const usersList = document.querySelector("#users-list");

function goToLogin() {
  sessionStorage.removeItem("authToken");
  window.location.replace("/");
}

document.querySelector("#logout-button").addEventListener("click", goToLogin);

if (!token) {
  goToLogin();
} else {
  fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.message || "Unable to load users.");
        error.status = response.status;
        throw error;
      }
      return body;
    })
    .then(({ users }) => {
      usersList.innerHTML = users.map((user) => `
        <tr><td>${escapeHtml(user.username)}</td><td>${new Date(user.created_at).toLocaleDateString()}</td></tr>
      `).join("");
      message.textContent = `${users.length} registered user${users.length === 1 ? "" : "s"}.`;
      message.className = "form-message success";
    })
    .catch((error) => {
      if (error.status === 401) goToLogin();
      else {
        message.textContent = error.message;
        message.className = "form-message error";
      }
    });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]));
}
