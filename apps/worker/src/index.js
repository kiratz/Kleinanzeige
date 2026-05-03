const path = require("node:path");
const {
  loadEnv,
  ensureAppFiles,
  readJsonFile,
  writeJsonFile,
} = require("../../../packages/config/index.js");

const env = loadEnv();
const { jobsFile, stateFile, settingsFile } = ensureAppFiles();

function computeDealScore(job) {
  let score = 20;
  const text = String(job.freeText ?? "").toLowerCase();
  if (job.maxPrice && job.maxPrice <= 1000) score += 20;
  if (text.includes("rtx") || text.includes("gaming")) score += 15;
  if (text.includes("leise") || text.includes("silent")) score += 10;
  if ((job.aiSearchPlan?.keywords ?? []).length >= 6) score += 15;
  if (job.radiusKm <= 50) score += 10;
  return Math.min(score, 95);
}

function runLoop() {
  const jobs = readJsonFile(jobsFile, []);
  const settings = readJsonFile(settingsFile, {
    notifications: {
      telegramEnabled: false,
      telegramBotToken: "",
      telegramChatId: "",
      whatsappEnabled: false,
      whatsappAccessToken: "",
      whatsappPhoneNumberId: "",
      whatsappTargetNumber: "",
    },
    search: {
      defaultIntervalMinutes: 10,
      defaultRadiusKm: 25,
      dealScoreThreshold: 80,
    },
  });
  const state = readJsonFile(stateFile, {
    notifications: [],
    snoozedSearchJobs: {},
    worker: {
      lastRunAt: null,
      lastSummary: "Noch kein Lauf",
      pendingIntegration: true,
    },
  });
  const now = new Date();
  let changed = false;
  let checkedJobs = 0;
  let scoredDeals = 0;

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
    checkedJobs += 1;

    const dealScore = computeDealScore(job);
    const threshold = Number(settings.search?.dealScoreThreshold ?? 80);
    if (dealScore >= threshold) {
      scoredDeals += 1;
      job.lastDealFoundAt = now.toISOString();
      state.notifications.push({
        id: `${job.id}:${now.toISOString()}`,
        searchJobId: job.id,
        title: job.title,
        createdAt: now.toISOString(),
        channel: settings.notifications?.telegramEnabled
          ? "telegram"
          : settings.notifications?.whatsappEnabled
            ? "whatsapp"
            : "pending",
        score: dealScore,
        message: `Moegliches Schnaeppchen fuer "${job.title}" erkannt. Vorlaeufiger Deal-Score: ${dealScore}/100. Echte Kleinanzeigen-Integration folgt als naechster Ausbauschritt.`,
      });
      job.snoozedUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
    } else {
      job.snoozedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }
  }

  state.worker = {
    lastRunAt: now.toISOString(),
    lastSummary: `Checked ${checkedJobs} jobs, ${scoredDeals} score hits, crawler integration pending`,
    pendingIntegration: true,
  };
  changed = true;

  if (changed) {
    writeJsonFile(jobsFile, jobs);
    writeJsonFile(stateFile, state);
  }

  console.log(`[worker] ${state.worker.lastSummary}`);
}

console.log(`Kleinanzeige worker active on logical port ${env.WORKER_PORT}`);
runLoop();
setInterval(runLoop, 30_000);
