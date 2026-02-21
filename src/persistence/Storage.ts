import { app } from 'electron';
import { mkdir, readdir, readFile, rm, stat, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ContentPack, HistoryGame, PackSummary, Settings } from '../shared/types';

const DEFAULT_SETTINGS: Settings = {
  winMode: 'judge',
  timerSeconds: 45,
  level: 'adult',
  activeTags: [],
  activePackIds: ['core'],
  gameEndMode: 'points',
  targetPoints: 7,
  targetRounds: 10,
  hideInputMode: true,
  saveHistory: true
};

export class Storage {
  private userDataPath = app.getPath('userData');
  private settingsPath = path.join(this.userDataPath, 'settings.json');
  private packsDir = path.join(this.userDataPath, 'installed_packs');
  private historyPath = path.join(this.userDataPath, 'game_history.json');

  async init(): Promise<void> {
    await mkdir(this.packsDir, { recursive: true });
    if (!existsSync(this.settingsPath)) {
      await this.writeJSON(this.settingsPath, DEFAULT_SETTINGS);
    }
    if (!existsSync(this.historyPath)) {
      await this.writeJSON(this.historyPath, []);
    }
  }

  async ensureCorePack(corePackPath: string): Promise<void> {
    const target = path.join(this.packsDir, 'core.json');
    if (!existsSync(target)) {
      await copyFile(corePackPath, target);
    }
  }

  async getSettings(): Promise<Settings> {
    const loaded = await this.readJSON<Partial<Settings>>(this.settingsPath, DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...loaded,
      level: 'adult',
      timerSeconds: [30, 45, 60].includes(loaded.timerSeconds ?? 45)
        ? (loaded.timerSeconds as 30 | 45 | 60)
        : 45
    };
  }

  async saveSettings(settings: Settings): Promise<Settings> {
    const merged = { ...DEFAULT_SETTINGS, ...settings, level: 'adult' };
    await this.writeJSON(this.settingsPath, merged);
    return merged;
  }

  async listPacks(): Promise<PackSummary[]> {
    const files = await readdir(this.packsDir);
    const summaries: PackSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fullPath = path.join(this.packsDir, file);
      const pack = await this.readJSON<ContentPack | null>(fullPath, null);
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

  async getPack(id: string): Promise<ContentPack | null> {
    const filePath = path.join(this.packsDir, `${id}.json`);
    if (!existsSync(filePath)) return null;
    return this.readJSON<ContentPack | null>(filePath, null);
  }

  async savePack(pack: ContentPack): Promise<ContentPack> {
    const cleanId = pack.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const normalized: ContentPack = {
      ...pack,
      id: cleanId,
      subjects: pack.subjects ?? [],
      templates: pack.templates ?? []
    };
    await this.writeJSON(path.join(this.packsDir, `${cleanId}.json`), normalized);
    return normalized;
  }

  async deletePack(id: string): Promise<boolean> {
    if (id === 'core') return false;
    const filePath = path.join(this.packsDir, `${id}.json`);
    if (!existsSync(filePath)) return false;
    await rm(filePath);
    return true;
  }

  async importPack(fromPath: string): Promise<ContentPack | null> {
    const pack = await this.readJSON<ContentPack | null>(fromPath, null);
    if (!pack?.id || !pack?.name || !Array.isArray(pack.subjects) || !Array.isArray(pack.templates)) {
      return null;
    }
    return this.savePack(pack);
  }

  async exportPack(id: string, toPath: string): Promise<boolean> {
    const pack = await this.getPack(id);
    if (!pack) return false;
    await this.writeJSON(toPath, pack);
    return true;
  }

  async loadActivePacks(activePackIds: string[]): Promise<ContentPack[]> {
    const packs: ContentPack[] = [];
    for (const packId of activePackIds) {
      const pack = await this.getPack(packId);
      if (pack) packs.push(pack);
    }
    return packs;
  }

  async appendHistory(entry: HistoryGame): Promise<boolean> {
    const history = await this.readHistory();
    history.unshift(entry);
    await this.writeJSON(this.historyPath, history.slice(0, 200));
    return true;
  }

  async readHistory(): Promise<HistoryGame[]> {
    return this.readJSON<HistoryGame[]>(this.historyPath, []);
  }

  getUserDataPath(): string {
    return this.userDataPath;
  }

  getPackPath(id: string): string {
    return path.join(this.packsDir, `${id}.json`);
  }

  private async readJSON<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJSON(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    } else {
      const s = await stat(dir);
      if (!s.isDirectory()) {
        throw new Error(`Path is not a directory: ${dir}`);
      }
    }
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  }
}

export { DEFAULT_SETTINGS };
