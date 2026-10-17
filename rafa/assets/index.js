const registrationForm = document.getElementById("registration-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const registerButton = document.getElementById("register-button");
const registrationMessage = document.getElementById("registration-message");
const loginForm = document.getElementById("login-form");
const loginUsernameInput = document.getElementById("login-username");
const loginPasswordInput = document.getElementById("login-password");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");
let csrfToken = null;

function showRegistrationMessage(message, type = "") {
  registrationMessage.textContent = message;
  registrationMessage.className = "form-message";

  if (type) {
    registrationMessage.classList.add(`is-${type}`);
  }
}

// Paso 1: detenemos la recarga del formulario y validamos sus campos en el navegador.
registrationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!registrationForm.reportValidity()) {
    showRegistrationMessage("Revisá los datos ingresados antes de continuar.", "error");
    return;
  }

  registerButton.disabled = true;
  registerButton.textContent = "Creating account...";
  showRegistrationMessage("Registrando usuario...");

  try {
    // Paso 2: la ruta relativa funciona tanto en localhost como dentro de Kubernetes.
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: usernameInput.value,
        password: passwordInput.value,
      }),
    });

    const data = await response.json().catch(() => ({}));

    // Paso 3: conservamos los mismos códigos y mensajes esperados por el backend actual.
    if (response.status === 201) {
      showRegistrationMessage(data.message || "Usuario registrado correctamente.", "success");
      usernameInput.value = "";
    } else if (response.status === 409) {
      showRegistrationMessage(data.error || "El username ya está registrado.", "error");
    } else if (response.status === 400) {
      showRegistrationMessage(data.error || "Los datos ingresados no son válidos.", "error");
    } else {
      showRegistrationMessage("No fue posible registrar el usuario. Intentá nuevamente.", "error");
    }
  } catch (error) {
    showRegistrationMessage("No se pudo conectar con el servidor. Intentá nuevamente.", "error");
  } finally {
    // Paso 4: la contraseña se limpia siempre y el botón vuelve a quedar disponible.
    passwordInput.value = "";
    registerButton.disabled = false;
    registerButton.textContent = "Create account";
  }
});

function showLoginMessage(message, type = "") {
  loginMessage.textContent = message;
  loginMessage.className = "form-message";

  if (type) {
    loginMessage.classList.add(`is-${type}`);
  }
}

async function getCsrfToken(forceRefresh = false) {
  if (csrfToken && !forceRefresh) {
    return csrfToken;
  }

  const response = await fetch("/api/auth/csrf-token", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("CSRF token unavailable");
  }

  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

// El token permanece únicamente en memoria y se envía en una cabecera propia.
// La cookie de sesión es HttpOnly, por lo que JavaScript nunca puede leer su valor.
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!loginForm.reportValidity()) {
    showLoginMessage("Revisá los datos ingresados antes de continuar.", "error");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Checking credentials...";
  showLoginMessage("Verificando acceso...");

  try {
    const token = await getCsrfToken();
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
      },
      body: JSON.stringify({
        username: loginUsernameInput.value,
        password: loginPasswordInput.value,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      window.location.assign("/dashboard");
      return;
    }

    if (response.status === 400 || response.status === 401) {
      showLoginMessage(data.error || "Username o password incorrectos.", "error");
    } else if (response.status === 429) {
      showLoginMessage("Demasiados intentos. Esperá unos minutos antes de reintentar.", "error");
    } else if (response.status === 403) {
      await getCsrfToken(true);
      showLoginMessage("La sesión de acceso cambió. Intentá nuevamente.", "error");
    } else if (response.status === 503) {
      showLoginMessage("El servicio de autenticación no está disponible temporalmente.", "error");
    } else {
      showLoginMessage("No fue posible iniciar sesión. Intentá nuevamente.", "error");
    }
  } catch (error) {
    showLoginMessage("No se pudo conectar con el servidor. Intentá nuevamente.", "error");
  } finally {
    // La contraseña se borra siempre, incluso cuando el servidor rechaza el acceso.
    loginPasswordInput.value = "";
    loginButton.disabled = false;
    loginButton.textContent = "Open dashboard";
  }
});

// Un redireccionamiento por sesión vencida muestra contexto sin revelar información sensible.
const authNotice = new URLSearchParams(window.location.search).get("auth");

if (authNotice === "required") {
  showLoginMessage("Iniciá sesión para abrir el dashboard.", "error");
} else if (authNotice === "logged-out") {
  showLoginMessage("La sesión se cerró correctamente.", "success");
}
