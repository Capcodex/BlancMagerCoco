export type Level = 'soft' | 'mid' | 'adult';
export type WinMode = 'judge' | 'vote';

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

export interface RoomSettings {
  timerSeconds: 30 | 45 | 60;
  level: Level;
  tags: string[];
  winMode: WinMode;
  gameEndMode: 'points' | 'rounds';
  targetPoints: number;
  targetRounds: number;
}

export interface Player {
  id: string;
  name: string;
  socketId: string;
  connected: boolean;
}

export interface RevealResponse {
  id: string;
  answerRaw: string;
  playerId: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
}

export interface RoomSnapshot {
  roomId: string;
  hostPlayerId: string;
  phase: 'lobby' | 'round' | 'reveal' | 'scoreboard' | 'finished';
  settings: RoomSettings;
  players: PublicPlayer[];
  scores: Record<string, number>;
  roundIndex: number;
  judgePlayerId: string | null;
  voteOrder: string[];
  currentVoterId: string | null;
  roundEndsAt: number | null;
  currentSubject: string | null;
  currentTemplate: string | null;
  holesCount: 1 | 2;
  revealResponses: Array<{ id: string; filledText: string }>;
  lastWinnerId: string | null;
  winnerId: string | null;
}
