const http = require("node:http");
const { randomUUID, createHash } = require("node:crypto");
const {
  loadEnv,
  buildSearchPlanFromInput,
  rootDir,
  hashPassword,
  verifyPassword,
  ensureDataDir,
} = require("../../../packages/config/index.js");
const { getStorage } = require("../../../packages/core/storage.js");
const { buildKleinanzeigenSearchUrl } = require("../../../packages/core/crawler.js");

const env = loadEnv();
const storage = getStorage();
const dataDir = ensureDataDir();
const sessions = new Map();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendNoContent(response) {
  response.writeHead(204);
  response.end();
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Body too large"));
      }
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function parseCookies(request) {
  const header = request.headers.cookie;
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header.split(";").map((pair) => {
      const [key, ...rest] = pair.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    }),
  );
}

function getSession(request) {
  const cookies = parseCookies(request);
  const sessionId = cookies.kleinanzeige_session;
  if (!sessionId) {
    return null;
  }

  return sessions.get(sessionId) ?? null;
}

function setSession(response, username) {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    id: sessionId,
    username,
    createdAt: new Date().toISOString(),
  });

  response.setHeader(
    "Set-Cookie",
    `kleinanzeige_session=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax`,
  );
}

function clearSession(request, response) {
  const cookies = parseCookies(request);
  if (cookies.kleinanzeige_session) {
    sessions.delete(cookies.kleinanzeige_session);
  }

  response.setHeader(
    "Set-Cookie",
    "kleinanzeige_session=deleted; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
  );
}

function requireAuth(request, response) {
  const session = getSession(request);
  if (!session) {
    sendJson(response, 401, { error: "Not authenticated" });
    return null;
  }

  return session;
}

function withCors(response) {
  response.setHeader("Access-Control-Allow-Origin", `http://localhost:${env.APP_PORT}`);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
}

function listJobs() {
  return storage.listJobs();
}

function saveJobs(jobs) {
  storage.saveJobs(jobs);
}

function listState() {
  return storage.listState();
}

function saveState(state) {
  storage.saveState(state);
}

function getUser() {
  return storage.getUser();
}

function saveUser(user) {
  storage.saveUser(user);
}

function getSettings() {
  return storage.getSettings();
}

function saveSettings(settings) {
  storage.saveSettings(settings);
}

function listListings() {
  return storage.listListings();
}

function saveListings(listings) {
  storage.saveListings(listings);
}

function normalizeSearchJob(input) {
  const settings = getSettings();
  const freeText = String(input.freeText ?? "").trim();
  const title = String(input.title ?? "").trim();
  const category = String(input.category ?? "").trim();
  const radiusKm = Number(input.radiusKm ?? settings.search.defaultRadiusKm ?? 25);
  const maxPrice = input.maxPrice === "" || input.maxPrice == null ? null : Number(input.maxPrice);
  const minPrice = input.minPrice === "" || input.minPrice == null ? null : Number(input.minPrice);
  const intervalMinutes = Number(input.intervalMinutes ?? settings.search.defaultIntervalMinutes ?? 10);
  const status = String(input.status ?? "active");

  const searchPlan = buildSearchPlanFromInput({
    freeText,
    category,
    radiusKm,
    maxPrice,
    minPrice,
  });

  return {
    title: title || freeText || "Unbenannter Suchauftrag",
    freeText,
    category,
    radiusKm,
    minPrice,
    maxPrice,
    intervalMinutes,
    status,
    aiSearchPlan: searchPlan,
    sourcePlan: {
      provider: "kleinanzeigen",
      searchUrl: buildKleinanzeigenSearchUrl({
        title: title || freeText,
        aiSearchPlan: searchPlan,
        radiusKm,
        maxPrice,
      }),
    },
  };
}

function createSearchJob(input) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
    lastDealFoundAt: null,
    snoozedUntil: null,
    ...normalizeSearchJob(input),
  };
}

function summarizeSearchState(jobs, state) {
  const activeJobs = jobs.filter((job) => job.status === "active").length;
  const snoozedJobs = jobs.filter((job) => job.snoozedUntil).length;
  return {
    rootDir,
    dataDir,
    activeJobs,
    snoozedJobs,
    notificationsSent: state.notifications.length,
    worker: state.worker ?? null,
  };
}

const server = http.createServer(async (request, response) => {
  withCors(response);

  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/health") {
    const jobs = listJobs();
    const state = listState();
    sendJson(response, 200, {
      application: "kleinanzeige-api",
      status: "ok",
      timestampUtc: new Date().toISOString(),
      auth: { configured: Boolean(getUser()?.username) },
      system: summarizeSearchState(jobs, state),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const body = await readBody(request);
      const user = getUser();
      const valid =
        body.username === user.username &&
        verifyPassword(String(body.password ?? ""), user.passwordHash);

      if (!valid) {
        sendJson(response, 401, { error: "Invalid username or password" });
        return;
      }

      setSession(response, body.username);
      sendJson(response, 200, {
        user: {
          username: body.username,
        },
      });
    } catch (error) {
      sendJson(response, 400, { error: "Invalid request body" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    clearSession(request, response);
    sendNoContent(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const session = getSession(request);
    if (!session) {
      sendJson(response, 401, { error: "Not authenticated" });
      return;
    }

    sendJson(response, 200, {
      user: {
        username: session.username,
      },
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    const jobs = listJobs();
    const state = listState();
    sendJson(response, 200, {
      user: session,
      summary: summarizeSearchState(jobs, state),
      settings: getSettings(),
      listingSummary: {
        total: listListings().length,
      },
      recentNotifications: state.notifications.slice(-10).reverse(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/listings") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    const searchJobId = url.searchParams.get("searchJobId");
    const items = listListings()
      .filter((listing) => !searchJobId || listing.searchJobId === searchJobId)
      .sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt));
    sendJson(response, 200, { items });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/worker/run-now") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    const state = listState();
    state.worker = {
      ...(state.worker ?? {}),
      requestedAt: new Date().toISOString(),
      requestedBy: session.username,
      runNowRequested: true,
    };
    saveState(state);
    sendJson(response, 202, { ok: true, worker: state.worker });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/settings") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    sendJson(response, 200, getSettings());
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/settings") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    try {
      const body = await readBody(request);
      const current = getSettings();
      const nextSettings = {
        notifications: {
          ...current.notifications,
          ...body.notifications,
        },
        search: {
          ...current.search,
          ...body.search,
        },
        crawler: {
          ...current.crawler,
          ...body.crawler,
        },
      };
      saveSettings(nextSettings);
      sendJson(response, 200, nextSettings);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid request body" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/account/password") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    try {
      const body = await readBody(request);
      const user = getUser();
      const currentPassword = String(body.currentPassword ?? "");
      const nextPassword = String(body.newPassword ?? "");

      if (!verifyPassword(currentPassword, user.passwordHash)) {
        sendJson(response, 400, { error: "Current password is incorrect" });
        return;
      }

      if (nextPassword.length < 8) {
        sendJson(response, 400, { error: "New password must be at least 8 characters" });
        return;
      }

      saveUser({
        ...user,
        passwordHash: hashPassword(nextPassword),
        updatedAt: new Date().toISOString(),
      });

      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { error: "Invalid request body" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/search-jobs") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    sendJson(response, 200, { items: listJobs() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-jobs") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    try {
      const body = await readBody(request);
      const jobs = listJobs();
      const nextJob = createSearchJob(body);
      jobs.push(nextJob);
      saveJobs(jobs);
      sendJson(response, 201, nextJob);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid request body" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-jobs/preview-plan") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    try {
      const body = await readBody(request);
      const preview = normalizeSearchJob(body).aiSearchPlan;
      sendJson(response, 200, preview);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid request body" });
    }
    return;
  }

  const searchJobMatch = url.pathname.match(/^\/api\/search-jobs\/([a-f0-9-]+)$/i);
  if (searchJobMatch) {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    const jobId = searchJobMatch[1];
    const jobs = listJobs();
    const index = jobs.findIndex((job) => job.id === jobId);

    if (index === -1) {
      sendJson(response, 404, { error: "Search job not found" });
      return;
    }

    if (request.method === "PUT") {
      try {
        const body = await readBody(request);
        jobs[index] = {
          ...jobs[index],
          ...normalizeSearchJob(body),
          updatedAt: new Date().toISOString(),
        };
        saveJobs(jobs);
        sendJson(response, 200, jobs[index]);
      } catch (error) {
        sendJson(response, 400, { error: "Invalid request body" });
      }
      return;
    }

    if (request.method === "DELETE") {
      jobs.splice(index, 1);
      saveJobs(jobs);
      sendNoContent(response);
      return;
    }
  }

  const snoozeMatch = url.pathname.match(/^\/api\/search-jobs\/([a-f0-9-]+)\/snooze$/i);
  if (snoozeMatch && request.method === "POST") {
    const session = requireAuth(request, response);
    if (!session) {
      return;
    }

    try {
      const body = await readBody(request);
      const jobs = listJobs();
      const job = jobs.find((entry) => entry.id === snoozeMatch[1]);
      if (!job) {
        sendJson(response, 404, { error: "Search job not found" });
        return;
      }

      const snoozeHours = Number(body.snoozeHours ?? 24);
      job.snoozedUntil = new Date(Date.now() + snoozeHours * 60 * 60 * 1000).toISOString();
      job.updatedAt = new Date().toISOString();
      saveJobs(jobs);
      sendJson(response, 200, job);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid request body" });
    }
    return;
  }

  sendJson(response, 404, {
    error: "Not found",
    requestId: createHash("sha1").update(`${request.method}:${url.pathname}`).digest("hex").slice(0, 12),
  });
});

server.listen(env.API_PORT, () => {
  console.log(`Kleinanzeige API listening on http://localhost:${env.API_PORT}`);
  console.log(`Data directory: ${dataDir}`);
});
