const path = require("node:path");
const {
  loadEnv,
  ensureDataDir,
  readJsonFile,
  writeJsonFile,
} = require("../../../packages/config/index.js");

const env = loadEnv();
const dataDir = ensureDataDir();
const jobsFile = path.join(dataDir, "search-jobs.json");
const stateFile = path.join(dataDir, "search-state.json");

function runLoop() {
  const jobs = readJsonFile(jobsFile, []);
  const state = readJsonFile(stateFile, { notifications: [], snoozedSearchJobs: {} });
  const now = new Date();
  let changed = false;

  for (const job of jobs) {
    if (job.status !== "active") {
      continue;
    }

    if (job.snoozedUntil && new Date(job.snoozedUntil) > now) {
      continue;
    }

    const minutesSinceLastCheck = job.lastCheckedAt
      ? (now.getTime() - new Date(job.lastCheckedAt).getTime()) / 60000
      : Infinity;

    if (minutesSinceLastCheck < Number(job.intervalMinutes ?? 10)) {
      continue;
    }

    job.lastCheckedAt = now.toISOString();
    changed = true;

    const hasHighValueSignal =
      Number(job.maxPrice ?? 0) > 0 &&
      String(job.freeText ?? "").length > 20 &&
      Array.isArray(job.aiSearchPlan?.keywords) &&
      job.aiSearchPlan.keywords.length >= 2;

    if (hasHighValueSignal) {
      job.lastDealFoundAt = now.toISOString();
      state.notifications.push({
        id: `${job.id}:${now.toISOString()}`,
        searchJobId: job.id,
        title: job.title,
        createdAt: now.toISOString(),
        channel: env.TELEGRAM_BOT_TOKEN ? "telegram" : "pending",
        message: `Moegliches Schnaeppchen fuer "${job.title}" erkannt. KI-Pruefung spaeter mit echtem Kleinanzeigen-Scan ergaenzen.`,
      });
      job.snoozedUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
    }
  }

  if (changed) {
    writeJsonFile(jobsFile, jobs);
    writeJsonFile(stateFile, state);
  }

  console.log(
    `[worker] ${now.toISOString()} checked ${jobs.length} jobs, notifications=${state.notifications.length}`,
  );
}

console.log(`Kleinanzeige worker active on logical port ${env.WORKER_PORT}`);
runLoop();
setInterval(runLoop, 30_000);
