export type Level = 'soft' | 'mid' | 'adult';

export interface RoomSettings {
  timerSeconds: 30 | 45 | 60;
  level: Level;
  tags: string[];
  winMode: 'judge' | 'vote';
  gameEndMode: 'points' | 'rounds';
  targetPoints: number;
  targetRounds: number;
}

export interface RoomSnapshot {
  roomId: string;
  hostPlayerId: string;
  phase: 'lobby' | 'round' | 'reveal' | 'scoreboard' | 'finished';
  settings: RoomSettings;
  players: Array<{ id: string; name: string; connected: boolean }>;
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
