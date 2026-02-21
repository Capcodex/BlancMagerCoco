import { RoundCards } from '../shared/types';

export interface EngineConfig {
  timerSeconds: 30 | 45 | 60;
  winMode: 'judge' | 'vote';
  gameEndMode: 'points' | 'rounds';
  targetPoints: number;
  targetRounds: number;
}

export interface EnginePlayer {
  id: string;
  name: string;
}

interface PlayerResponse {
  playerId: string;
  answerRaw: string;
}

export interface RevealResponse {
  id: string;
  answerRaw: string;
  playerId: string;
}

export interface RoundState {
  index: number;
  judgePlayerId: string;
  cards: RoundCards;
  responses: PlayerResponse[];
  locked: boolean;
}

export class GameEngine {
  private players: EnginePlayer[] = [];
  private config!: EngineConfig;
  private scores = new Map<string, number>();
  private roundIndex = 0;
  private judgeIndex = 0;
  private roundState: RoundState | null = null;
  private revealResponses: RevealResponse[] = [];
  private voteOrder: string[] = [];
  private votes = new Map<string, string>();

  start(players: EnginePlayer[], config: EngineConfig): void {
    if (players.length < 3 || players.length > 10) {
      throw new Error('Le jeu demande entre 3 et 10 joueurs.');
    }
    this.players = players;
    this.config = config;
    this.roundIndex = 0;
    this.judgeIndex = 0;
    this.roundState = null;
    this.revealResponses = [];
    this.voteOrder = [];
    this.votes.clear();
    this.scores.clear();
    for (const p of players) this.scores.set(p.id, 0);
  }

  startRound(cards: RoundCards): RoundState {
    this.roundIndex += 1;
    const judgePlayerId = this.players[this.judgeIndex % this.players.length].id;
    this.roundState = {
      index: this.roundIndex,
      judgePlayerId,
      cards,
      responses: [],
      locked: false
    };
    this.revealResponses = [];
    this.voteOrder = [];
    this.votes.clear();
    return this.roundState;
  }

  submitResponse(playerId: string, answerRaw: string): void {
    if (!this.roundState) throw new Error('Manche non demarree.');
    if (this.roundState.locked) throw new Error('Reponses verrouillees.');
    const existing = this.roundState.responses.find((r) => r.playerId === playerId);
    if (existing) {
      existing.answerRaw = answerRaw;
      return;
    }
    this.roundState.responses.push({ playerId, answerRaw });
  }

  lockResponses(): RevealResponse[] {
    if (!this.roundState) throw new Error('Manche non demarree.');
    this.roundState.locked = true;

    this.revealResponses = this.roundState.responses
      .map((r, i) => ({
        id: `resp-${this.roundState?.index}-${i + 1}`,
        answerRaw: r.answerRaw,
        playerId: r.playerId
      }))
      .sort(() => Math.random() - 0.5);

    if (this.config.winMode === 'vote') {
      this.voteOrder = this.players
        .filter((p) => p.id !== this.roundState.judgePlayerId)
        .map((p) => p.id);
      this.votes.clear();
    }

    return this.revealResponses;
  }

  pickWinnerByJudge(responseId: string): string {
    if (this.config.winMode !== 'judge') throw new Error('Mode actuel: vote.');
    const winner = this.findWinnerFromResponse(responseId);
    this.incrementScore(winner);
    this.closeRound();
    return winner;
  }

  castVote(voterId: string, responseId: string): { done: boolean; winnerId?: string } {
    if (this.config.winMode !== 'vote') throw new Error('Mode actuel: juge.');
    if (!this.roundState) throw new Error('Manche non demarree.');
    if (!this.voteOrder.includes(voterId)) throw new Error('Votant non autorise.');

    const winner = this.findWinnerFromResponse(responseId);
    this.votes.set(voterId, winner);

    if (this.votes.size === this.voteOrder.length) {
      const tally = new Map<string, number>();
      for (const voted of this.votes.values()) {
        tally.set(voted, (tally.get(voted) ?? 0) + 1);
      }
      const winnerId = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
      this.incrementScore(winnerId);
      this.closeRound();
      return { done: true, winnerId };
    }

    return { done: false };
  }

  getVoteOrder(): string[] {
    return [...this.voteOrder];
  }

  getJudgeId(): string {
    if (!this.roundState) throw new Error('Manche non demarree.');
    return this.roundState.judgePlayerId;
  }

  getScores(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const p of this.players) {
      result[p.id] = this.scores.get(p.id) ?? 0;
    }
    return result;
  }

  getPlayers(): EnginePlayer[] {
    return [...this.players];
  }

  getRoundState(): RoundState | null {
    return this.roundState;
  }

  isGameOver(): boolean {
    if (this.config.gameEndMode === 'points') {
      return Math.max(...this.scores.values()) >= this.config.targetPoints;
    }
    return this.roundIndex >= this.config.targetRounds;
  }

  getOverallWinnerId(): string {
    return [...this.scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  private findWinnerFromResponse(responseId: string): string {
    const response = this.revealResponses.find((r) => r.id === responseId);
    if (!response) throw new Error('Reponse introuvable.');
    return response.playerId;
  }

  private incrementScore(playerId: string): void {
    this.scores.set(playerId, (this.scores.get(playerId) ?? 0) + 1);
  }

  private closeRound(): void {
    this.judgeIndex = (this.judgeIndex + 1) % this.players.length;
  }
}
