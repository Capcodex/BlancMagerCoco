import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { fillTemplate, nextCards } from './content.js';
import {
  Player,
  RevealResponse,
  RoomSettings,
  RoomSnapshot
} from './types.js';

interface RoomState {
  roomId: string;
  hostPlayerId: string;
  phase: 'lobby' | 'round' | 'reveal' | 'scoreboard' | 'finished';
  settings: RoomSettings;
  players: Player[];
  scores: Record<string, number>;
  roundIndex: number;
  judgeIndex: number;
  judgePlayerId: string | null;
  usedSubjectIds: Set<string>;
  usedTemplateIds: Set<string>;
  subjectText: string | null;
  templateText: string | null;
  holesCount: 1 | 2;
  responses: Map<string, string>;
  revealResponses: RevealResponse[];
  voteOrder: string[];
  currentVoterIndex: number;
  roundEndsAt: number | null;
  timerHandle: NodeJS.Timeout | null;
  lastWinnerId: string | null;
  winnerId: string | null;
}

const DEFAULT_SETTINGS: RoomSettings = {
  timerSeconds: 45,
  level: 'adult',
  tags: [],
  winMode: 'judge',
  gameEndMode: 'points',
  targetPoints: 7,
  targetRounds: 10
};

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const rooms = new Map<string, RoomState>();
const socketBinding = new Map<string, { roomId: string; playerId: string }>();
const voteMapByRoom = new Map<string, Map<string, string>>();

function createRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getPublicSnapshot(room: RoomState): RoomSnapshot {
  const revealResponses = room.revealResponses.map((r) => ({
    id: r.id,
    filledText: fillTemplate(room.templateText ?? '', r.answerRaw)
  }));

  return {
    roomId: room.roomId,
    hostPlayerId: room.hostPlayerId,
    phase: room.phase,
    settings: room.settings,
    players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
    scores: room.scores,
    roundIndex: room.roundIndex,
    judgePlayerId: room.judgePlayerId,
    voteOrder: room.voteOrder,
    currentVoterId: room.voteOrder[room.currentVoterIndex] ?? null,
    roundEndsAt: room.roundEndsAt,
    currentSubject: room.subjectText,
    currentTemplate: room.templateText,
    holesCount: room.holesCount,
    revealResponses,
    lastWinnerId: room.lastWinnerId,
    winnerId: room.winnerId
  };
}

function emitRoom(room: RoomState): void {
  io.to(room.roomId).emit('room:update', getPublicSnapshot(room));
}

function clearRoomTimer(room: RoomState): void {
  if (room.timerHandle) {
    clearTimeout(room.timerHandle);
    room.timerHandle = null;
  }
}

function isHost(room: RoomState, playerId: string): boolean {
  return room.hostPlayerId === playerId;
}

function findPlayer(room: RoomState, playerId: string): Player | undefined {
  return room.players.find((p) => p.id === playerId);
}

function ensureJudge(room: RoomState): string {
  const players = room.players;
  if (!players.length) {
    throw new Error('Room vide');
  }
  const judge = players[room.judgeIndex % players.length];
  room.judgePlayerId = judge.id;
  return judge.id;
}

function startRound(room: RoomState): void {
  room.roundIndex += 1;
  room.phase = 'round';
  room.lastWinnerId = null;
  room.winnerId = null;
  voteMapByRoom.delete(room.roomId);
  room.responses.clear();
  room.revealResponses = [];
  room.voteOrder = [];
  room.currentVoterIndex = 0;

  const cards = nextCards(room.settings.level, room.settings.tags, room.usedSubjectIds, room.usedTemplateIds);
  room.subjectText = cards.subject.text;
  room.templateText = cards.template.text;
  room.holesCount = cards.template.holesCount;
  ensureJudge(room);

  clearRoomTimer(room);
  room.roundEndsAt = Date.now() + room.settings.timerSeconds * 1000;
  room.timerHandle = setTimeout(() => {
    lockRound(room);
    emitRoom(room);
  }, room.settings.timerSeconds * 1000);
}

function lockRound(room: RoomState): void {
  if (room.phase !== 'round') return;
  clearRoomTimer(room);

  const responderIds = room.players
    .filter((p) => p.id !== room.judgePlayerId)
    .map((p) => p.id);

  for (const responderId of responderIds) {
    if (!room.responses.has(responderId)) {
      room.responses.set(responderId, '');
    }
  }

  const reveal: RevealResponse[] = responderIds.map((playerId, i) => ({
    id: `resp-${room.roundIndex}-${i + 1}`,
    playerId,
    answerRaw: room.responses.get(playerId) ?? ''
  }));

  reveal.sort(() => Math.random() - 0.5);
  room.revealResponses = reveal;
  room.phase = 'reveal';
  room.roundEndsAt = null;

  if (room.settings.winMode === 'vote') {
    room.voteOrder = room.players.filter((p) => p.id !== room.judgePlayerId).map((p) => p.id);
    room.currentVoterIndex = 0;
  }
}

function closeRound(room: RoomState, winnerId: string): void {
  room.lastWinnerId = winnerId;
  room.scores[winnerId] = (room.scores[winnerId] ?? 0) + 1;
  room.phase = 'scoreboard';

  const byPoints = room.settings.gameEndMode === 'points' && room.scores[winnerId] >= room.settings.targetPoints;
  const byRounds = room.settings.gameEndMode === 'rounds' && room.roundIndex >= room.settings.targetRounds;

  if (byPoints || byRounds) {
    room.phase = 'finished';
    const entries = Object.entries(room.scores);
    room.winnerId = entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  room.judgeIndex = (room.judgeIndex + 1) % room.players.length;
}

function nextConnectedPlayerId(room: RoomState): string | null {
  const player = room.players.find((p) => p.connected);
  return player?.id ?? null;
}

function skipDisconnectedVoters(room: RoomState): void {
  if (room.settings.winMode !== 'vote') return;
  while (room.currentVoterIndex < room.voteOrder.length) {
    const id = room.voteOrder[room.currentVoterIndex];
    const player = room.players.find((p) => p.id === id);
    if (player?.connected) return;
    room.currentVoterIndex += 1;
  }
}

function pickWinnerByVote(room: RoomState, votes: Map<string, string>): string {
  const counts = new Map<string, number>();
  for (const responseId of votes.values()) {
    counts.set(responseId, (counts.get(responseId) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0]?.[1] ?? 0;
  const finalists = sorted.filter((x) => x[1] === topScore).map((x) => x[0]);
  const winnerResponseId = finalists[Math.floor(Math.random() * finalists.length)];
  const winnerResponse = room.revealResponses.find((r) => r.id === winnerResponseId);
  if (!winnerResponse) throw new Error('Vote invalide');
  return winnerResponse.playerId;
}

io.on('connection', (socket: Socket) => {
  socket.on('room:create', (payload: { name: string }, cb?: (res: unknown) => void) => {
    const name = (payload?.name ?? '').trim();
    if (!name) {
      cb?.({ ok: false, error: 'Nom requis' });
      return;
    }

    const roomId = createRoomId();
    const playerId = uuidv4();
    const player: Player = { id: playerId, name, socketId: socket.id, connected: true };

    const room: RoomState = {
      roomId,
      hostPlayerId: playerId,
      phase: 'lobby',
      settings: { ...DEFAULT_SETTINGS },
      players: [player],
      scores: { [playerId]: 0 },
      roundIndex: 0,
      judgeIndex: 0,
      judgePlayerId: null,
      usedSubjectIds: new Set(),
      usedTemplateIds: new Set(),
      subjectText: null,
      templateText: null,
      holesCount: 1,
      responses: new Map(),
      revealResponses: [],
      voteOrder: [],
      currentVoterIndex: 0,
      roundEndsAt: null,
      timerHandle: null,
      lastWinnerId: null,
      winnerId: null
    };

    rooms.set(roomId, room);
    socketBinding.set(socket.id, { roomId, playerId });
    socket.join(roomId);
    emitRoom(room);
    cb?.({ ok: true, roomId, playerId });
  });

  socket.on('room:join', (payload: { roomId: string; name: string }, cb?: (res: unknown) => void) => {
    const roomId = (payload?.roomId ?? '').trim().toUpperCase();
    const name = (payload?.name ?? '').trim();
    const room = rooms.get(roomId);

    if (!room) {
      cb?.({ ok: false, error: 'Room introuvable' });
      return;
    }
    if (room.players.length >= 10) {
      cb?.({ ok: false, error: 'Room complete (10 joueurs max)' });
      return;
    }
    if (!name) {
      cb?.({ ok: false, error: 'Nom requis' });
      return;
    }

    const playerId = uuidv4();
    const player: Player = { id: playerId, name, socketId: socket.id, connected: true };
    room.players.push(player);
    room.scores[playerId] = room.scores[playerId] ?? 0;

    socketBinding.set(socket.id, { roomId, playerId });
    socket.join(roomId);
    emitRoom(room);
    cb?.({ ok: true, roomId, playerId });
  });

  socket.on('game:update_settings', (payload: Partial<RoomSettings>) => {
    const binding = socketBinding.get(socket.id);
    if (!binding) return;
    const room = rooms.get(binding.roomId);
    if (!room || !isHost(room, binding.playerId) || room.phase !== 'lobby') return;

    room.settings = {
      ...room.settings,
      ...payload,
      level: 'adult',
      timerSeconds: [30, 45, 60].includes(Number(payload.timerSeconds))
        ? (payload.timerSeconds as 30 | 45 | 60)
        : room.settings.timerSeconds,
      targetPoints: Math.max(1, Number(payload.targetPoints ?? room.settings.targetPoints)),
      targetRounds: Math.max(1, Number(payload.targetRounds ?? room.settings.targetRounds))
    };
    emitRoom(room);
  });

  socket.on('game:start', () => {
    const binding = socketBinding.get(socket.id);
    if (!binding) return;
    const room = rooms.get(binding.roomId);
    if (!room || !isHost(room, binding.playerId)) return;
    if (room.players.length < 3) return;

    room.scores = {};
    for (const p of room.players) room.scores[p.id] = 0;
    room.usedSubjectIds.clear();
    room.usedTemplateIds.clear();
    room.roundIndex = 0;
    room.judgeIndex = 0;
    room.winnerId = null;
    startRound(room);
    emitRoom(room);
  });

  socket.on('round:submit', (payload: { answer: string }) => {
    const binding = socketBinding.get(socket.id);
    if (!binding) return;
    const room = rooms.get(binding.roomId);
    if (!room || room.phase !== 'round') return;
    if (binding.playerId === room.judgePlayerId) return;

    room.responses.set(binding.playerId, String(payload?.answer ?? '').slice(0, 220));

    const responderCount = room.players.filter((p) => p.id !== room.judgePlayerId).length;
    if (room.responses.size >= responderCount) {
      lockRound(room);
    }
    emitRoom(room);
  });

  socket.on('round:lock', () => {
    const binding = socketBinding.get(socket.id);
    if (!binding) return;
    const room = rooms.get(binding.roomId);
    if (!room || room.phase !== 'round') return;

    if (!isHost(room, binding.playerId) && room.judgePlayerId !== binding.playerId) return;
    lockRound(room);
    emitRoom(room);
  });

  socket.on('reveal:judge_pick', (payload: { responseId: string }) => {
    const binding = socketBinding.get(socket.id);
    if (!binding) return;
    const room = rooms.get(binding.roomId);
    if (!room || room.phase !== 'reveal' || room.settings.winMode !== 'judge') return;
    if (room.judgePlayerId !== binding.playerId) return;

    const response = room.revealResponses.find((r) => r.id === payload?.responseId);
    if (!response) return;

    closeRound(room, response.playerId);
    voteMapByRoom.delete(room.roomId);
    emitRoom(room);
  });

  socket.on('reveal:vote', (payload: { responseId: string }) => {
    const binding = socketBinding.get(socket.id);
    if (!binding) return;
    const room = rooms.get(binding.roomId);
    if (!room || room.phase !== 'reveal' || room.settings.winMode !== 'vote') return;

    skipDisconnectedVoters(room);
    const currentVoterId = room.voteOrder[room.currentVoterIndex];
    if (!currentVoterId || currentVoterId !== binding.playerId) return;

    const response = room.revealResponses.find((r) => r.id === payload?.responseId);
    if (!response) return;

    const voteMap = voteMapByRoom.get(room.roomId) ?? new Map<string, string>();
    voteMap.set(binding.playerId, response.id);
    voteMapByRoom.set(room.roomId, voteMap);

    room.currentVoterIndex += 1;
    skipDisconnectedVoters(room);

    if (room.currentVoterIndex >= room.voteOrder.length) {
      const winnerId = pickWinnerByVote(room, voteMap);
      voteMapByRoom.delete(room.roomId);
      closeRound(room, winnerId);
    }

    emitRoom(room);
  });

  socket.on('round:next', () => {
    const binding = socketBinding.get(socket.id);
    if (!binding) return;
    const room = rooms.get(binding.roomId);
    if (!room || !isHost(room, binding.playerId)) return;

    if (room.phase === 'scoreboard') {
      startRound(room);
      emitRoom(room);
    }
  });

  socket.on('disconnect', () => {
    const binding = socketBinding.get(socket.id);
    socketBinding.delete(socket.id);
    if (!binding) return;

    const room = rooms.get(binding.roomId);
    if (!room) return;

    const player = findPlayer(room, binding.playerId);
    if (player) player.connected = false;

    if (room.hostPlayerId === binding.playerId) {
      const nextHost = nextConnectedPlayerId(room);
      if (nextHost) room.hostPlayerId = nextHost;
    }

    if (room.judgePlayerId === binding.playerId) {
      const nextJudge = nextConnectedPlayerId(room);
      if (nextJudge) room.judgePlayerId = nextJudge;
    }

    if (room.phase === 'reveal' && room.settings.winMode === 'vote') {
      skipDisconnectedVoters(room);
      if (room.currentVoterIndex >= room.voteOrder.length) {
        const voteMap = voteMapByRoom.get(room.roomId) ?? new Map<string, string>();
        if (voteMap.size) {
          const winnerId = pickWinnerByVote(room, voteMap);
          voteMapByRoom.delete(room.roomId);
          closeRound(room, winnerId);
        }
      }
    }

    if (room.players.every((p) => !p.connected)) {
      clearRoomTimer(room);
      rooms.delete(room.roomId);
      return;
    }

    emitRoom(room);
  });
});

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => {
  console.log(`Multiplayer server listening on ${port}`);
});
