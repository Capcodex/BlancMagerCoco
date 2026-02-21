export type Level = 'soft' | 'mid' | 'adult';

export interface SubjectCard {
  id: string;
  text: string;
  level: Level;
  tags: string[];
}

export interface TemplateCard {
  id: string;
  text: string;
  level: Level;
  tags: string[];
  holesCount: 1 | 2;
}

export interface ContentPack {
  id: string;
  name: string;
  version: string;
  subjects: SubjectCard[];
  templates: TemplateCard[];
}

export interface PackSummary {
  id: string;
  name: string;
  version: string;
  subjectCount: number;
  templateCount: number;
}

export interface Settings {
  winMode: 'judge' | 'vote';
  timerSeconds: 30 | 45 | 60;
  level: Level;
  activeTags: string[];
  activePackIds: string[];
  gameEndMode: 'points' | 'rounds';
  targetPoints: number;
  targetRounds: number;
  hideInputMode: boolean;
  saveHistory: boolean;
}

export interface RoundCards {
  subject: SubjectCard;
  template: TemplateCard;
}

export interface Player {
  id: string;
  name: string;
}

export interface RoundResponse {
  playerId: string;
  text: string;
  createdAt: number;
}

export interface HistoryGame {
  id: string;
  playedAt: string;
  players: string[];
  winner: string;
  score: Record<string, number>;
  rounds: number;
  mode: 'judge' | 'vote';
}

export interface StorageApi {
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<Settings>;
  listPacks: () => Promise<PackSummary[]>;
  getPack: (packId: string) => Promise<ContentPack | null>;
  savePack: (pack: ContentPack) => Promise<ContentPack>;
  deletePack: (packId: string) => Promise<boolean>;
  importPackFromDialog: () => Promise<ContentPack | null>;
  exportPackToDialog: (packId: string) => Promise<boolean>;
  loadActivePacks: () => Promise<ContentPack[]>;
  appendHistory: (entry: HistoryGame) => Promise<boolean>;
  readHistory: () => Promise<HistoryGame[]>;
}

declare global {
  interface Window {
    storageApi: StorageApi;
  }
}
