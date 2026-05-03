const {
  loadEnv,
  ensureAppFiles,
  readJsonFile,
  writeJsonFile,
  hashPassword,
} = require("../config/index.js");

class JsonStorage {
  constructor() {
    const env = loadEnv();
    const files = ensureAppFiles();
    this.env = env;
    this.files = files;
  }

  getUser() {
    return readJsonFile(this.files.userFile, null);
  }

  saveUser(user) {
    writeJsonFile(this.files.userFile, user);
  }

  getSettings() {
    return readJsonFile(this.files.settingsFile, {
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
      crawler: {
        mode: "manual-placeholder",
        note: "Kleinanzeigen-Integration folgt spaeter per Browser-Automation.",
      },
      updatedAt: new Date().toISOString(),
    });
  }

  saveSettings(settings) {
    writeJsonFile(this.files.settingsFile, {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  }

  listJobs() {
    return readJsonFile(this.files.jobsFile, []);
  }

  saveJobs(jobs) {
    writeJsonFile(this.files.jobsFile, jobs);
  }

  listState() {
    return readJsonFile(this.files.stateFile, {
      notifications: [],
      snoozedSearchJobs: {},
      worker: {
        lastRunAt: null,
        lastSummary: "Noch kein Lauf",
        pendingIntegration: true,
      },
    });
  }

  saveState(state) {
    writeJsonFile(this.files.stateFile, state);
  }

  listListings() {
    return readJsonFile(this.files.listingsFile, []);
  }

  saveListings(listings) {
    writeJsonFile(this.files.listingsFile, listings);
  }
}

class PostgresStorage {
  constructor() {
    throw new Error(
      "PostgreSQL storage is not wired yet. Install a pg-backed repository implementation and switch STORAGE_DRIVER only after that step.",
    );
  }
}

let storageInstance = null;

function createStorage() {
  const env = loadEnv();
  if (env.STORAGE_DRIVER === "postgres") {
    return new PostgresStorage();
  }

  return new JsonStorage();
}

function getStorage() {
  if (!storageInstance) {
    storageInstance = createStorage();
  }

  return storageInstance;
}

module.exports = {
  getStorage,
  JsonStorage,
  PostgresStorage,
};
