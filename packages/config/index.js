const fs = require("node:fs");
const { randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "../..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function loadEnv() {
  const envFile = parseEnvFile(path.join(rootDir, ".env"));
  const get = (name, fallback) => process.env[name] ?? envFile[name] ?? fallback;
  return {
    APP_NAME: get("APP_NAME", "Kleinanzeige"),
    APP_PORT: Number(get("APP_PORT", "3000")),
    API_PORT: Number(get("API_PORT", "4000")),
    WORKER_PORT: Number(get("WORKER_PORT", "4010")),
    APP_DATA_DIR: get("APP_DATA_DIR", ""),
    APP_USERNAME: get("APP_USERNAME", "admin"),
    APP_PASSWORD: get("APP_PASSWORD", "change-me"),
    APP_PASSWORD_HASH: get("APP_PASSWORD_HASH", ""),
    SESSION_SECRET: get("SESSION_SECRET", "change-me-too"),
    TELEGRAM_BOT_TOKEN: get("TELEGRAM_BOT_TOKEN", ""),
    TELEGRAM_CHAT_ID: get("TELEGRAM_CHAT_ID", ""),
    WHATSAPP_ACCESS_TOKEN: get("WHATSAPP_ACCESS_TOKEN", ""),
    WHATSAPP_PHONE_NUMBER_ID: get("WHATSAPP_PHONE_NUMBER_ID", ""),
    WHATSAPP_TARGET_NUMBER: get("WHATSAPP_TARGET_NUMBER", ""),
  };
}

function ensureDataDir() {
  const env = loadEnv();
  const dataDir = env.APP_DATA_DIR
    ? path.resolve(env.APP_DATA_DIR)
    : path.join(process.env.TEMP || os.tmpdir(), "kleinanzeige");
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    writeJsonFile(filePath, fallback);
    return structuredClone(fallback);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildSearchPlanFromInput(input) {
  const freeText = String(input.freeText ?? "").toLowerCase();
  const cleanedWords = freeText
    .replace(/[^\w\säöüß-]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  const keywords = [...new Set(cleanedWords)].slice(0, 12);
  const excludeKeywords = [];

  if (freeText.includes("kein") || freeText.includes("ohne")) {
    excludeKeywords.push("defekt", "bastler");
  }

  if (freeText.includes("leise")) {
    keywords.push("silent");
  }

  if (freeText.includes("gaming")) {
    keywords.push("rtx", "ryzen", "geforce");
  }

  if (freeText.includes("office")) {
    excludeKeywords.push("gaming", "rgb");
  }

  const reasoning = [
    "Freitext in Keywords zerlegt",
    "offensichtliche Kauf-Signale erkannt",
    "Ausschluesse fuer unpassende Anzeigen ergaenzt",
  ];

  return {
    generatedAt: new Date().toISOString(),
    category: input.category || null,
    radiusKm: Number(input.radiusKm ?? 25),
    priceRange: {
      min: input.minPrice == null || input.minPrice === "" ? null : Number(input.minPrice),
      max: input.maxPrice == null || input.maxPrice === "" ? null : Number(input.maxPrice),
    },
    keywords: [...new Set(keywords)].slice(0, 16),
    excludeKeywords: [...new Set(excludeKeywords)],
    reasoning,
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedKey] = String(storedHash || "").split(":");
  if (!salt || !expectedKey) {
    return false;
  }

  const actualKey = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedKey, "hex");
  return expectedBuffer.length === actualKey.length && timingSafeEqual(actualKey, expectedBuffer);
}

function ensureAppFiles() {
  const env = loadEnv();
  const dataDir = ensureDataDir();
  const userFile = path.join(dataDir, "user.json");
  const settingsFile = path.join(dataDir, "settings.json");
  const jobsFile = path.join(dataDir, "search-jobs.json");
  const stateFile = path.join(dataDir, "search-state.json");

  if (!fs.existsSync(userFile)) {
    writeJsonFile(userFile, {
      username: env.APP_USERNAME,
      passwordHash: env.APP_PASSWORD_HASH || hashPassword(env.APP_PASSWORD),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (!fs.existsSync(settingsFile)) {
    writeJsonFile(settingsFile, {
      notifications: {
        telegramEnabled: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        telegramBotToken: env.TELEGRAM_BOT_TOKEN,
        telegramChatId: env.TELEGRAM_CHAT_ID,
        whatsappEnabled: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_TARGET_NUMBER),
        whatsappAccessToken: env.WHATSAPP_ACCESS_TOKEN,
        whatsappPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
        whatsappTargetNumber: env.WHATSAPP_TARGET_NUMBER,
      },
      search: {
        defaultIntervalMinutes: 10,
        defaultRadiusKm: 25,
        dealScoreThreshold: 80,
      },
      crawler: {
        mode: "manual-placeholder",
        note: "Kleinanzeigen-Integration folgt spaeter per Browser-Automation.",
      },
      updatedAt: new Date().toISOString(),
    });
  }

  readJsonFile(jobsFile, []);
  readJsonFile(stateFile, {
    notifications: [],
    snoozedSearchJobs: {},
    worker: {
      lastRunAt: null,
      lastSummary: "Noch kein Lauf",
      pendingIntegration: true,
    },
  });

  return { dataDir, userFile, settingsFile, jobsFile, stateFile };
}

module.exports = {
  rootDir,
  loadEnv,
  ensureDataDir,
  readJsonFile,
  writeJsonFile,
  buildSearchPlanFromInput,
  hashPassword,
  verifyPassword,
  ensureAppFiles,
};
