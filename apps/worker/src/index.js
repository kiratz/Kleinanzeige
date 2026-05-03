const {
  loadEnv,
} = require("../../../packages/config/index.js");
const { getStorage } = require("../../../packages/core/storage.js");
const { simulateListingsForJob, computeFakeMarketScore } = require("../../../packages/core/crawler.js");

const env = loadEnv();
const storage = getStorage();

function runLoop() {
  const jobs = storage.listJobs();
  const settings = storage.getSettings();
  const state = storage.listState();
  const listings = storage.listListings();
  const now = new Date();
  const forceRun = Boolean(state.worker?.runNowRequested);
  let changed = false;
  let checkedJobs = 0;
  let scoredDeals = 0;

  for (const job of jobs) {
    if (job.status !== "active") {
      continue;
    }

    if (!forceRun && job.snoozedUntil && new Date(job.snoozedUntil) > now) {
      continue;
    }

    const minutesSinceLastCheck = job.lastCheckedAt
      ? (now.getTime() - new Date(job.lastCheckedAt).getTime()) / 60000
      : Infinity;

    if (!forceRun && minutesSinceLastCheck < Number(job.intervalMinutes ?? 10)) {
      continue;
    }

    job.lastCheckedAt = now.toISOString();
    changed = true;
    checkedJobs += 1;

    const newListings = simulateListingsForJob(job).filter(
      (candidate) =>
        !listings.some(
          (existing) =>
            existing.searchJobId === candidate.searchJobId && existing.externalId === candidate.externalId,
        ),
    );

    for (const listing of newListings) {
      listings.push(listing);
    }

    const dealScore = computeFakeMarketScore(job);
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
    requestedAt: state.worker?.requestedAt ?? null,
    requestedBy: state.worker?.requestedBy ?? null,
    runNowRequested: false,
  };
  changed = true;

  if (changed) {
    storage.saveJobs(jobs);
    storage.saveState(state);
    storage.saveListings(listings);
  }

  console.log(`[worker] ${state.worker.lastSummary}`);
}

console.log(`Kleinanzeige worker active on logical port ${env.WORKER_PORT}`);
runLoop();
setInterval(runLoop, 30_000);
