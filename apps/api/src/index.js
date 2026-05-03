const http = require("node:http");
const { randomUUID, createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  loadEnv,
  ensureDataDir,
  readJsonFile,
  writeJsonFile,
  buildSearchPlanFromInput,
  rootDir,
} = require("../../../packages/config/index.js");

const env = loadEnv();
const dataDir = ensureDataDir();
const jobsFile = path.join(dataDir, "search-jobs.json");
const stateFile = path.join(dataDir, "search-state.json");
const sessions = new Map();

readJsonFile(jobsFile, []);
readJsonFile(stateFile, { notifications: [], snoozedSearchJobs: {} });

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
  return readJsonFile(jobsFile, []);
}

function saveJobs(jobs) {
  writeJsonFile(jobsFile, jobs);
}

function listState() {
  return readJsonFile(stateFile, { notifications: [], snoozedSearchJobs: {} });
}

function saveState(state) {
  writeJsonFile(stateFile, state);
}

function normalizeSearchJob(input) {
  const freeText = String(input.freeText ?? "").trim();
  const title = String(input.title ?? "").trim();
  const category = String(input.category ?? "").trim();
  const radiusKm = Number(input.radiusKm ?? 25);
  const maxPrice = input.maxPrice === "" || input.maxPrice == null ? null : Number(input.maxPrice);
  const minPrice = input.minPrice === "" || input.minPrice == null ? null : Number(input.minPrice);
  const intervalMinutes = Number(input.intervalMinutes ?? 10);
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
      auth: {
        username: env.APP_USERNAME,
      },
      system: summarizeSearchState(jobs, state),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const body = await readBody(request);
      if (body.username !== env.APP_USERNAME || body.password !== env.APP_PASSWORD) {
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
      recentNotifications: state.notifications.slice(-10).reverse(),
    });
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
