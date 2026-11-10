const legacyFields = ["runtime", "container", "orchestrator", "replicas", "service"];
const namespaceValue = document.getElementById("namespace-value");
const apiValue = document.getElementById("api-value");
const systemLabel = document.getElementById("system-label");
const runtimeValue = document.getElementById("runtime-value");
const replicasValue = document.getElementById("replicas-value");
const serviceValue = document.getElementById("service-value");
const summaryStates = document.querySelectorAll(".summary-state");
const progressList = document.getElementById("progress-list");
const progressSummary = document.getElementById("progress-summary");
const deploymentList = document.getElementById("deployment-list");
const connectionState = document.getElementById("connection-state");
const connectionText = document.getElementById("connection-text");
const authenticatedUsername = document.getElementById("authenticated-username");
const logoutButton = document.getElementById("logout-button");
const logoutMessage = document.getElementById("logout-message");
const evidenceList = document.getElementById("evidence-list");
const rbacSource = document.getElementById("rbac-source");
const rbacNamespace = document.getElementById("rbac-namespace");
const rbacChain = document.getElementById("rbac-chain");
const rbacAssignment = document.getElementById("rbac-assignment");
const permissionList = document.getElementById("permission-list");
let csrfToken = null;

function renderMilestones(milestones) {
  const fragment = document.createDocumentFragment();
  const completed = milestones.filter((milestone) => milestone.state === "Completed").length;

  progressSummary.textContent = `${completed} of ${milestones.length} completed`;

  if (milestones.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "Course progress unavailable.";
    progressList.replaceChildren(emptyMessage);
    return;
  }

  milestones.forEach((milestone, index) => {
    const item = document.createElement("article");
    const number = document.createElement("span");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const summary = document.createElement("p");
    const state = document.createElement("span");

    item.className = "mission-item";
    number.className = "mission-number";
    copy.className = "mission-copy";
    state.className = "mission-status";
    number.textContent = String(index + 1).padStart(2, "0");
    title.textContent = milestone.title;
    summary.textContent = milestone.summary;
    state.textContent = milestone.state;
    copy.append(title, summary);
    item.append(number, copy, state);
    fragment.append(item);
  });

  progressList.replaceChildren(fragment);
}

function renderDeployment(items) {
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    row.className = "status-row";
    row.setAttribute("role", "row");
    label.setAttribute("role", "cell");
    value.setAttribute("role", "cell");
    label.textContent = item.label;
    value.textContent = item.value;
    row.append(label, value);
    fragment.append(row);
  });

  deploymentList.replaceChildren(fragment);
}

function renderEvidence(items) {
  if (items.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "Recorded evidence unavailable.";
    evidenceList.replaceChildren(emptyMessage);
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const article = document.createElement("article");
    const state = document.createElement("span");
    const title = document.createElement("strong");
    const summary = document.createElement("p");

    article.className = "evidence-item";
    state.className = "evidence-state";
    state.textContent = item.state;
    title.textContent = item.title;
    summary.textContent = item.summary;
    article.append(state, title, summary);
    fragment.append(article);
  });

  evidenceList.replaceChildren(fragment);
}

function renderAccessControl(accessControl = {}) {
  const resources = Array.isArray(accessControl.resources) ? accessControl.resources : [];
  const checks = Array.isArray(accessControl.checks) ? accessControl.checks : [];

  rbacSource.textContent = accessControl.source || "Recorded validation unavailable";
  rbacNamespace.textContent = accessControl.namespace || "No disponible";
  rbacAssignment.textContent = accessControl.assignment || "Assignment information unavailable.";

  if (resources.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "RBAC relationship unavailable.";
    rbacChain.replaceChildren(emptyMessage);
  } else {
    const resourceFragment = document.createDocumentFragment();

    resources.forEach((resource) => {
      const article = document.createElement("article");
      const kind = document.createElement("span");
      const name = document.createElement("strong");
      const summary = document.createElement("p");

      article.className = "rbac-resource";
      kind.textContent = resource.kind;
      name.textContent = resource.name;
      summary.textContent = resource.summary;
      article.append(kind, name, summary);
      resourceFragment.append(article);
    });

    rbacChain.replaceChildren(resourceFragment);
  }

  if (checks.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "Authorization checks unavailable.";
    permissionList.replaceChildren(emptyMessage);
    return;
  }

  const checkFragment = document.createDocumentFragment();

  checks.forEach((check) => {
    const row = document.createElement("div");
    const action = document.createElement("span");
    const scope = document.createElement("span");
    const result = document.createElement("strong");
    const isAllowed = check.result === "Allowed";

    row.className = "permission-row";
    row.setAttribute("role", "row");
    action.setAttribute("role", "cell");
    scope.setAttribute("role", "cell");
    result.setAttribute("role", "cell");
    action.dataset.label = "Action";
    scope.dataset.label = "Scope";
    result.dataset.label = "Result";
    result.className = `permission-result ${isAllowed ? "is-allowed" : "is-denied"}`;
    action.textContent = check.action;
    scope.textContent = check.scope;
    result.textContent = check.result;
    row.append(action, scope, result);
    checkFragment.append(row);
  });

  permissionList.replaceChildren(checkFragment);
}

function setSummaryState(text, className = "") {
  summaryStates.forEach((state) => {
    state.textContent = text;
    state.className = "summary-state";

    if (className) {
      state.classList.add(className);
    }
  });
}

function renderStatusUnavailable() {
  namespaceValue.textContent = "No disponible";
  apiValue.textContent = "Unavailable";
  systemLabel.textContent = "System unavailable";
  runtimeValue.textContent = "No disponible";
  replicasValue.textContent = "No disponible";
  serviceValue.textContent = "No disponible";
  setSummaryState("API unavailable", "is-error");
  renderMilestones([]);
  renderDeployment([{ label: "Deployment data", value: "No disponible" }]);
  renderEvidence([]);
  renderAccessControl();
  connectionText.textContent = "API unavailable";
  connectionState.classList.add("is-error");
}

async function loadAuthenticatedUser() {
  const response = await fetch("/api/auth/session", { credentials: "same-origin" });

  if (response.status === 401) {
    window.location.replace("/?auth=required#login");
    return false;
  }

  if (!response.ok) {
    throw new Error("Session unavailable");
  }

  const data = await response.json();
  authenticatedUsername.textContent = data.user.username;
  csrfToken = data.csrfToken;
  return true;
}

async function loadLabStatus() {
  const response = await fetch("/api/status");

  if (!response.ok) {
    throw new Error("Status API unavailable");
  }

  const data = await response.json();
  const deploymentItems = Array.isArray(data.deployment) && data.deployment.length > 0
    ? data.deployment
    : legacyFields.map((field) => ({ label: field, value: data[field] || "No disponible" }));
  const milestones = Array.isArray(data.milestones) ? data.milestones : [];
  const evidence = Array.isArray(data.evidence) ? data.evidence : [];

  namespaceValue.textContent = data.context?.namespace || "No disponible";
  apiValue.textContent = "Responding";
  systemLabel.textContent = "Configuration loaded";
  runtimeValue.textContent = data.runtime || "No disponible";
  replicasValue.textContent = data.replicas || "No disponible";
  serviceValue.textContent = data.service || "No disponible";
  setSummaryState("Declared by API", "is-running");
  renderMilestones(milestones);
  renderDeployment(deploymentItems);
  renderEvidence(evidence);
  renderAccessControl(data.accessControl);
  connectionText.textContent = "API response received";
  connectionState.classList.remove("is-error");
}

// Primero confirmamos la sesión y luego cargamos los datos educativos públicos.
async function initializeDashboard() {
  try {
    const authenticated = await loadAuthenticatedUser();

    if (!authenticated) {
      return;
    }
  } catch (error) {
    window.location.replace("/?auth=required#login");
    return;
  }

  try {
    await loadLabStatus();
  } catch (error) {
    renderStatusUnavailable();
  }
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutMessage.textContent = "Cerrando sesión...";

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
    });

    if (response.ok || response.status === 401) {
      window.location.replace("/?auth=logged-out#login");
      return;
    }

    logoutMessage.textContent = "No fue posible cerrar la sesión.";
  } catch (error) {
    logoutMessage.textContent = "No se pudo conectar con el servidor.";
  } finally {
    logoutButton.disabled = false;
  }
});

initializeDashboard();
