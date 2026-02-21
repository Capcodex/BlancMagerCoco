"use strict";
const electron = require("electron");
const path = require("node:path");
const promises = require("node:fs/promises");
const node_fs = require("node:fs");
const DEFAULT_SETTINGS = {
  winMode: "judge",
  timerSeconds: 45,
  level: "soft",
  activeTags: [],
  activePackIds: ["core"],
  gameEndMode: "points",
  targetPoints: 7,
  targetRounds: 10,
  hideInputMode: true,
  saveHistory: true
};
class Storage {
  userDataPath = electron.app.getPath("userData");
  settingsPath = path.join(this.userDataPath, "settings.json");
  packsDir = path.join(this.userDataPath, "installed_packs");
  historyPath = path.join(this.userDataPath, "game_history.json");
  async init() {
    await promises.mkdir(this.packsDir, { recursive: true });
    if (!node_fs.existsSync(this.settingsPath)) {
      await this.writeJSON(this.settingsPath, DEFAULT_SETTINGS);
    }
    if (!node_fs.existsSync(this.historyPath)) {
      await this.writeJSON(this.historyPath, []);
    }
  }
  async ensureCorePack(corePackPath) {
    const target = path.join(this.packsDir, "core.json");
    if (!node_fs.existsSync(target)) {
      await promises.copyFile(corePackPath, target);
    }
  }
  async getSettings() {
    const loaded = await this.readJSON(this.settingsPath, DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...loaded,
      timerSeconds: [30, 45, 60].includes(loaded.timerSeconds ?? 45) ? loaded.timerSeconds : 45
    };
  }
  async saveSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await this.writeJSON(this.settingsPath, merged);
    return merged;
  }
  async listPacks() {
    const files = await promises.readdir(this.packsDir);
    const summaries = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const fullPath = path.join(this.packsDir, file);
      const pack = await this.readJSON(fullPath, null);
      if (!pack) continue;
      summaries.push({
        id: pack.id,
        name: pack.name,
        version: pack.version,
        subjectCount: pack.subjects.length,
        templateCount: pack.templates.length
      });
    }
    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }
  async getPack(id) {
    const filePath = path.join(this.packsDir, `${id}.json`);
    if (!node_fs.existsSync(filePath)) return null;
    return this.readJSON(filePath, null);
  }
  async savePack(pack) {
    const cleanId = pack.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const normalized = {
      ...pack,
      id: cleanId,
      subjects: pack.subjects ?? [],
      templates: pack.templates ?? []
    };
    await this.writeJSON(path.join(this.packsDir, `${cleanId}.json`), normalized);
    return normalized;
  }
  async deletePack(id) {
    if (id === "core") return false;
    const filePath = path.join(this.packsDir, `${id}.json`);
    if (!node_fs.existsSync(filePath)) return false;
    await promises.rm(filePath);
    return true;
  }
  async importPack(fromPath) {
    const pack = await this.readJSON(fromPath, null);
    if (!pack?.id || !pack?.name || !Array.isArray(pack.subjects) || !Array.isArray(pack.templates)) {
      return null;
    }
    return this.savePack(pack);
  }
  async exportPack(id, toPath) {
    const pack = await this.getPack(id);
    if (!pack) return false;
    await this.writeJSON(toPath, pack);
    return true;
  }
  async loadActivePacks(activePackIds) {
    const packs = [];
    for (const packId of activePackIds) {
      const pack = await this.getPack(packId);
      if (pack) packs.push(pack);
    }
    return packs;
  }
  async appendHistory(entry) {
    const history = await this.readHistory();
    history.unshift(entry);
    await this.writeJSON(this.historyPath, history.slice(0, 200));
    return true;
  }
  async readHistory() {
    return this.readJSON(this.historyPath, []);
  }
  getUserDataPath() {
    return this.userDataPath;
  }
  getPackPath(id) {
    return path.join(this.packsDir, `${id}.json`);
  }
  async readJSON(filePath, fallback) {
    try {
      const raw = await promises.readFile(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  async writeJSON(filePath, data) {
    const dir = path.dirname(filePath);
    if (!node_fs.existsSync(dir)) {
      await promises.mkdir(dir, { recursive: true });
    } else {
      const s = await promises.stat(dir);
      if (!s.isDirectory()) {
        throw new Error(`Path is not a directory: ${dir}`);
      }
    }
    await promises.writeFile(filePath, `${JSON.stringify(data, null, 2)}
`, "utf-8");
  }
}
const storage = new Storage();
function getCorePackPath() {
  if (electron.app.isPackaged) {
    return path.join(process.resourcesPath, "resources", "packs", "core.json");
  }
  return path.join(process.cwd(), "resources", "packs", "core.json");
}
async function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1150,
    minHeight: 720,
    backgroundColor: "#121212",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    await win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function registerIpc() {
  electron.ipcMain.handle("settings:get", () => storage.getSettings());
  electron.ipcMain.handle("settings:save", (_evt, settings) => storage.saveSettings(settings));
  electron.ipcMain.handle("packs:list", () => storage.listPacks());
  electron.ipcMain.handle("packs:get", (_evt, packId) => storage.getPack(packId));
  electron.ipcMain.handle("packs:save", (_evt, pack) => storage.savePack(pack));
  electron.ipcMain.handle("packs:delete", (_evt, packId) => storage.deletePack(packId));
  electron.ipcMain.handle("packs:import-dialog", async () => {
    const result = await electron.dialog.showOpenDialog({
      title: "Importer un pack JSON",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return storage.importPack(result.filePaths[0]);
  });
  electron.ipcMain.handle("packs:export-dialog", async (_evt, packId) => {
    const pack = await storage.getPack(packId);
    if (!pack) return false;
    const result = await electron.dialog.showSaveDialog({
      title: "Exporter le pack JSON",
      defaultPath: `${pack.id}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return false;
    return storage.exportPack(packId, result.filePath);
  });
  electron.ipcMain.handle("packs:load-active", async () => {
    const settings = await storage.getSettings();
    return storage.loadActivePacks(settings.activePackIds);
  });
  electron.ipcMain.handle("history:append", (_evt, entry) => storage.appendHistory(entry));
  electron.ipcMain.handle("history:read", () => storage.readHistory());
}
electron.app.whenReady().then(async () => {
  await storage.init();
  await storage.ensureCorePack(getCorePackPath());
  registerIpc();
  await createWindow();
  electron.app.on("activate", async () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
