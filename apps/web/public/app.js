const apiBaseUrl = "http://localhost:4000";

const elements = {
  loginPanel: document.getElementById("login-panel"),
  appPanel: document.getElementById("app-panel"),
  loginForm: document.getElementById("login-form"),
  loginStatus: document.getElementById("login-status"),
  logoutButton: document.getElementById("logout-button"),
  jobForm: document.getElementById("job-form"),
  jobStatus: document.getElementById("job-status"),
  previewPlanButton: document.getElementById("preview-plan-button"),
  planPreview: document.getElementById("plan-preview"),
  jobs: document.getElementById("jobs"),
  notifications: document.getElementById("notifications"),
  summary: document.getElementById("summary"),
};

async function api(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

function readForm(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function renderJobs(items) {
  if (!items.length) {
    elements.jobs.innerHTML = "<li>Keine Suchauftraege vorhanden.</li>";
    return;
  }

  elements.jobs.innerHTML = items
    .map((job) => {
      const keywords = (job.aiSearchPlan?.keywords ?? []).join(", ");
      return `
        <li>
          <strong>${job.title}</strong><br>
          Status: ${job.status} | Radius: ${job.radiusKm} km | Max: ${job.maxPrice ?? "-"} EUR | Intervall: ${job.intervalMinutes} Min<br>
          Keywords: ${keywords || "-"}<br>
          Ausschluesse: ${(job.aiSearchPlan?.excludeKeywords ?? []).join(", ") || "-"}<br>
          Letzter Check: ${job.lastCheckedAt ?? "-"}<br>
          Snoozed bis: ${job.snoozedUntil ?? "-"}
        </li>
      `;
    })
    .join("");
}

function renderNotifications(items) {
  if (!items.length) {
    elements.notifications.innerHTML = "<li>Noch keine Benachrichtigungen.</li>";
    return;
  }

  elements.notifications.innerHTML = items
    .map(
      (item) => `
        <li>
          <strong>${item.title}</strong><br>
          ${item.message}<br>
          Kanal: ${item.channel} | ${item.createdAt}
        </li>
      `,
    )
    .join("");
}

async function loadDashboard() {
  const dashboard = await api("/api/dashboard");
  const jobs = await api("/api/search-jobs");
  elements.summary.textContent = `Aktiv: ${dashboard.summary.activeJobs}, Snoozed: ${dashboard.summary.snoozedJobs}, Daten: ${dashboard.summary.dataDir}`;
  renderJobs(jobs.items);
  renderNotifications(dashboard.recentNotifications);
}

async function checkSession() {
  try {
    await api("/api/auth/me");
    elements.loginPanel.classList.add("hidden");
    elements.appPanel.classList.remove("hidden");
    await loadDashboard();
  } catch {
    elements.loginPanel.classList.remove("hidden");
    elements.appPanel.classList.add("hidden");
  }
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginStatus.textContent = "";

  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(readForm(elements.loginForm)),
    });
    elements.loginForm.reset();
    await checkSession();
  } catch (error) {
    elements.loginStatus.textContent = error.message;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  await checkSession();
});

elements.previewPlanButton.addEventListener("click", async () => {
  elements.jobStatus.textContent = "";
  try {
    const preview = await api("/api/search-jobs/preview-plan", {
      method: "POST",
      body: JSON.stringify(readForm(elements.jobForm)),
    });
    elements.planPreview.textContent = JSON.stringify(preview, null, 2);
  } catch (error) {
    elements.jobStatus.textContent = error.message;
  }
});

elements.jobForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.jobStatus.textContent = "";

  try {
    await api("/api/search-jobs", {
      method: "POST",
      body: JSON.stringify(readForm(elements.jobForm)),
    });
    elements.jobForm.reset();
    elements.planPreview.textContent = "Suchauftrag gespeichert. Neue Vorschau bei Bedarf erneut laden.";
    await loadDashboard();
  } catch (error) {
    elements.jobStatus.textContent = error.message;
  }
});

checkSession();
setInterval(() => {
  if (!elements.appPanel.classList.contains("hidden")) {
    loadDashboard().catch(() => {});
  }
}, 15000);
