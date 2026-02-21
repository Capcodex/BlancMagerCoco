import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ContentManager } from '../../content/ContentManager';
import { EnginePlayer, GameEngine, RevealResponse } from '../../engine/GameEngine';
import { ContentPack, HistoryGame, PackSummary, RoundCards, Settings } from '../../shared/types';

interface GameContextValue {
  settings: Settings | null;
  packs: PackSummary[];
  activePacks: ContentPack[];
  availableTags: string[];
  players: EnginePlayer[];
  currentRound: RoundCards | null;
  roundNumber: number;
  judgeId: string | null;
  revealResponses: RevealResponse[];
  scores: Record<string, number>;
  lastWinnerId: string | null;
  voteOrder: string[];
  loading: boolean;
  refreshAll: () => Promise<void>;
  saveSettings: (update: Settings) => Promise<void>;
  startNewGame: (playerNames: string[]) => Promise<void>;
  startNextRound: () => Promise<void>;
  submitAnswer: (playerId: string, answer: string) => void;
  lockRound: () => void;
  pickWinnerJudge: (responseId: string) => Promise<string>;
  castVote: (voterId: string, responseId: string) => Promise<{ done: boolean; winnerId?: string }>;
  listPacks: () => Promise<void>;
  setPackActive: (packId: string, active: boolean) => Promise<void>;
  savePack: (pack: ContentPack) => Promise<void>;
  deletePack: (packId: string) => Promise<void>;
  importPack: () => Promise<void>;
  exportPack: (packId: string) => Promise<boolean>;
  getPack: (packId: string) => Promise<ContentPack | null>;
  isGameOver: boolean;
}

const Ctx = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => new GameEngine(), []);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [activePacks, setActivePacks] = useState<ContentPack[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [players, setPlayers] = useState<EnginePlayer[]>([]);
  const [currentRound, setCurrentRound] = useState<RoundCards | null>(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [revealResponses, setRevealResponses] = useState<RevealResponse[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [lastWinnerId, setLastWinnerId] = useState<string | null>(null);
  const [voteOrder, setVoteOrder] = useState<string[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usedSubjectIds, setUsedSubjectIds] = useState<Set<string>>(new Set());
  const [usedTemplateIds, setUsedTemplateIds] = useState<Set<string>>(new Set());

  const listPacks = async () => {
    const list = await window.storageApi.listPacks();
    setPacks(list);
  };

  const refreshAll = async () => {
    setLoading(true);
    const [st, list, active] = await Promise.all([
      window.storageApi.getSettings(),
      window.storageApi.listPacks(),
      window.storageApi.loadActivePacks()
    ]);
    setSettings(st);
    setPacks(list);
    setActivePacks(active);
    setAvailableTags(ContentManager.collectTags(active));
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const saveSettings = async (update: Settings) => {
    const saved = await window.storageApi.saveSettings(update);
    setSettings(saved);
    const active = await window.storageApi.loadActivePacks();
    setActivePacks(active);
    setAvailableTags(ContentManager.collectTags(active));
  };

  const startNewGame = async (playerNames: string[]) => {
    if (!settings) return;
    const clean = playerNames.map((p) => p.trim()).filter(Boolean);
    const mapped = clean.map((name) => ({ id: uuidv4(), name }));
    engine.start(mapped, {
      timerSeconds: settings.timerSeconds,
      winMode: settings.winMode,
      gameEndMode: settings.gameEndMode,
      targetPoints: settings.targetPoints,
      targetRounds: settings.targetRounds
    });
    setPlayers(mapped);
    setScores(engine.getScores());
    setRoundNumber(0);
    setLastWinnerId(null);
    setUsedSubjectIds(new Set());
    setUsedTemplateIds(new Set());
    setIsGameOver(false);
    await startNextRoundInternal(new Set(), new Set());
  };

  const startNextRoundInternal = async (subjectsSet?: Set<string>, templatesSet?: Set<string>) => {
    if (!settings) return;
    const subjects = subjectsSet ?? usedSubjectIds;
    const templates = templatesSet ?? usedTemplateIds;

    const cards = ContentManager.nextRoundCards({
      packs: activePacks,
      level: settings.level,
      activeTags: settings.activeTags,
      usedSubjectIds: subjects,
      usedTemplateIds: templates
    });

    subjects.add(cards.subject.id);
    templates.add(cards.template.id);
    setUsedSubjectIds(new Set(subjects));
    setUsedTemplateIds(new Set(templates));

    const round = engine.startRound(cards);
    setCurrentRound(cards);
    setRoundNumber(round.index);
    setJudgeId(round.judgePlayerId);
    setRevealResponses([]);
    setVoteOrder([]);
    setLastWinnerId(null);
  };

  const startNextRound = async () => {
    await startNextRoundInternal();
  };

  const submitAnswer = (playerId: string, answer: string) => {
    engine.submitResponse(playerId, answer);
  };

  const lockRound = () => {
    const reveal = engine.lockResponses();
    setRevealResponses(reveal);
    setVoteOrder(engine.getVoteOrder());
  };

  const saveHistoryIfNeeded = async () => {
    if (!settings?.saveHistory || !players.length) return;
    const winner = players.find((p) => p.id === engine.getOverallWinnerId());
    if (!winner) return;
    const entry: HistoryGame = {
      id: uuidv4(),
      playedAt: new Date().toISOString(),
      players: players.map((p) => p.name),
      winner: winner.name,
      score: engine.getScores(),
      rounds: roundNumber,
      mode: settings.winMode
    };
    await window.storageApi.appendHistory(entry);
  };

  const pickWinnerJudge = async (responseId: string) => {
    const winner = engine.pickWinnerByJudge(responseId);
    setLastWinnerId(winner);
    const nextScores = engine.getScores();
    setScores(nextScores);
    if (engine.isGameOver()) {
      setIsGameOver(true);
      await saveHistoryIfNeeded();
    }
    return winner;
  };

  const castVote = async (voterId: string, responseId: string) => {
    const result = engine.castVote(voterId, responseId);
    if (result.done && result.winnerId) {
      setLastWinnerId(result.winnerId);
      const nextScores = engine.getScores();
      setScores(nextScores);
      if (engine.isGameOver()) {
        setIsGameOver(true);
        await saveHistoryIfNeeded();
      }
    }
    return result;
  };

  const setPackActive = async (packId: string, active: boolean) => {
    if (!settings) return;
    const set = new Set(settings.activePackIds);
    if (active) set.add(packId);
    else if (packId !== 'core') set.delete(packId);
    await saveSettings({ ...settings, activePackIds: [...set] });
  };

  const savePack = async (pack: ContentPack) => {
    await window.storageApi.savePack(pack);
    await refreshAll();
  };

  const deletePack = async (packId: string) => {
    await window.storageApi.deletePack(packId);
    await refreshAll();
  };

  const importPack = async () => {
    await window.storageApi.importPackFromDialog();
    await refreshAll();
  };

  const exportPack = async (packId: string) => window.storageApi.exportPackToDialog(packId);

  const getPack = async (packId: string) => window.storageApi.getPack(packId);

  return (
    <Ctx.Provider
      value={{
        settings,
        packs,
        activePacks,
        availableTags,
        players,
        currentRound,
        roundNumber,
        judgeId,
        revealResponses,
        scores,
        lastWinnerId,
        voteOrder,
        loading,
        refreshAll,
        saveSettings,
        startNewGame,
        startNextRound,
        submitAnswer,
        lockRound,
        pickWinnerJudge,
        castVote,
        listPacks,
        setPackActive,
        savePack,
        deletePack,
        importPack,
        exportPack,
        getPack,
        isGameOver
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useGame() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGame doit etre utilise dans GameProvider');
  return ctx;
}
