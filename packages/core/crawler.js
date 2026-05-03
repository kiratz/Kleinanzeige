const { createHash } = require("node:crypto");

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function buildKleinanzeigenSearchUrl(job) {
  const query = encodeURIComponent(
    (job.aiSearchPlan?.keywords?.slice(0, 5) ?? [job.title]).join(" "),
  );
  const radius = encodeURIComponent(String(job.radiusKm ?? 25));
  const maxPrice = job.maxPrice ? `&price=${encodeURIComponent(`:${job.maxPrice}`)}` : "";
  return `https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${query}&radius=${radius}${maxPrice}`;
}

function computeFakeMarketScore(job) {
  let score = 40;
  const text = String(job.freeText ?? "").toLowerCase();
  if (text.includes("rtx") || text.includes("gaming")) score += 15;
  if (text.includes("leise") || text.includes("silent")) score += 10;
  if (job.maxPrice && job.maxPrice <= 1000) score += 15;
  if ((job.aiSearchPlan?.keywords ?? []).length >= 6) score += 10;
  return Math.min(score, 95);
}

function simulateListingsForJob(job) {
  const now = new Date().toISOString();
  const baseTitle = job.title || "Kleinanzeigen-Suche";
  const slug = slugify(baseTitle);
  const price = job.maxPrice ? Math.max(50, Math.round(job.maxPrice * 0.82)) : 499;
  const hash = createHash("sha1").update(`${job.id}:${job.updatedAt}`).digest("hex").slice(0, 10);
  const searchUrl = buildKleinanzeigenSearchUrl(job);
  const dealScore = computeFakeMarketScore(job);

  return [
    {
      id: `${job.id}:${hash}`,
      searchJobId: job.id,
      source: "kleinanzeigen-simulated",
      externalId: hash,
      title: `${baseTitle} - Neu eingestellt`,
      price,
      location: "Simulierter Treffer",
      listingUrl: `${searchUrl}#${slug}`,
      discoveredAt: now,
      verdict: dealScore >= 80 ? "deal_candidate" : "watch",
      dealScore,
      summary: "Simulierter Listing-Snapshot bis echte Browser-Automation angeschlossen ist.",
    },
  ];
}

module.exports = {
  buildKleinanzeigenSearchUrl,
  simulateListingsForJob,
  computeFakeMarketScore,
};
