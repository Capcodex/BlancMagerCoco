import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { RoomSnapshot, RoomSettings } from './types';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = rawApiUrl.startsWith('http') ? rawApiUrl : `https://${rawApiUrl}`;

interface JoinResult {
  ok: boolean;
  roomId?: string;
  playerId?: string;
  error?: string;
}

export function App() {
  const socket: Socket = useMemo(() => io(API_URL, { transports: ['websocket'] }), []);

  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [me, setMe] = useState<{ roomId: string; playerId: string } | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);
  const [answer, setAnswer] = useState('');
  const [roundTimer, setRoundTimer] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onUpdate = (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
    };
    const onConnect = () => {
      setSocketState('connected');
    };
    const onDisconnect = () => {
      setSocketState('disconnected');
    };
    const onConnectError = () => {
      setSocketState('disconnected');
      setError(`Connexion API impossible (${API_URL}). Verifie VITE_API_URL et l'etat du service API.`);
    };

    setSocketState(socket.connected ? 'connected' : 'connecting');
    socket.on('room:update', onUpdate);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('room:update', onUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.close();
    };
  }, [socket]);

  useEffect(() => {
    setSubmitted(false);
    setAnswer('');
  }, [room?.roundIndex]);

  useEffect(() => {
    if (!room?.roundEndsAt) {
      setRoundTimer(0);
      return;
    }

    const compute = () => {
      setRoundTimer(Math.max(0, Math.ceil((room.roundEndsAt! - Date.now()) / 1000)));
    };

    compute();
    const id = window.setInterval(compute, 500);
    return () => window.clearInterval(id);
  }, [room?.roundEndsAt]);

  const myPlayer = room?.players.find((p) => p.id === me?.playerId) ?? null;
  const isHost = !!room && me?.playerId === room.hostPlayerId;
  const isJudge = !!room && me?.playerId === room.judgePlayerId;
  const isCurrentVoter = !!room && me?.playerId === room.currentVoterId;
  const shouldAnswer = !!room && !isJudge && room.phase === 'round';

  const updateSetting = (partial: Partial<RoomSettings>) => {
    socket.emit('game:update_settings', partial);
  };

  const createRoom = () => {
    if (!socket.connected) {
      setError(`API non connectee (${API_URL}).`);
      return;
    }
    setError('');
    setPendingAction('create');
    socket.timeout(8000).emit('room:create', { name: name.trim() }, (err: unknown, res: JoinResult) => {
      setPendingAction(null);
      if (err) {
        setError('Creation timeout: API indisponible ou trop lente.');
        return;
      }
      if (!res?.ok || !res.roomId || !res.playerId) {
        setError(res?.error ?? 'Creation impossible');
        return;
      }
      setMe({ roomId: res.roomId, playerId: res.playerId });
    });
  };

  const joinRoom = () => {
    if (!socket.connected) {
      setError(`API non connectee (${API_URL}).`);
      return;
    }
    setError('');
    setPendingAction('join');
    socket.timeout(8000).emit(
      'room:join',
      { roomId: roomIdInput.trim().toUpperCase(), name: name.trim() },
      (err: unknown, res: JoinResult) => {
        setPendingAction(null);
        if (err) {
          setError('Connexion timeout: API indisponible ou trop lente.');
          return;
        }
        if (!res?.ok || !res.roomId || !res.playerId) {
          setError(res?.error ?? 'Connexion impossible');
          return;
        }
        setMe({ roomId: res.roomId, playerId: res.playerId });
      }
    );
  };

  if (!me || !room) {
    return (
      <div className="page center">
        <div className="panel">
          <h1>Limite Multiplayer</h1>
          <p>Version web multijoueur (Render-ready)</p>
          <p>API: {API_URL}</p>
          <p>Socket: {socketState}</p>

          <label>Ton pseudo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pseudo" />

          <div className="row">
            <button className="btn" onClick={createRoom} disabled={!name.trim() || pendingAction !== null}>
              {pendingAction === 'create' ? 'Creation...' : 'Creer une room'}
            </button>
          </div>

          <label>Code room</label>
          <input
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
            placeholder="ABC123"
          />
          <button
            className="btn secondary"
            onClick={joinRoom}
            disabled={!name.trim() || !roomIdInput.trim() || pendingAction !== null}
          >
            {pendingAction === 'join' ? 'Connexion...' : 'Rejoindre'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h2>Room {room.roomId}</h2>
          <p>
            Connecte en tant que <strong>{myPlayer?.name ?? 'Inconnu'}</strong>
          </p>
        </div>
        <div className="badge">Phase: {room.phase}</div>
      </header>

      <main className="layout">
        <section className="panel">
          <h3>Joueurs</h3>
          {room.players.map((p) => (
            <div key={p.id} className="player-row">
              <span>
                {p.name}
                {p.id === room.judgePlayerId ? ' (Juge)' : ''}
                {p.id === room.hostPlayerId ? ' (Host)' : ''}
              </span>
              <span>{p.connected ? 'en ligne' : 'hors ligne'}</span>
            </div>
          ))}
        </section>

        <section className="panel grow">
          {room.phase === 'lobby' && (
            <>
              <h3>Lobby</h3>
              <p>3 a 10 joueurs. Le host configure et lance la partie.</p>

              <div className="grid">
                <label>Mode gagnant</label>
                <select
                  value={room.settings.winMode}
                  disabled={!isHost}
                  onChange={(e) => updateSetting({ winMode: e.target.value as 'judge' | 'vote' })}
                >
                  <option value="judge">Juge</option>
                  <option value="vote">Vote</option>
                </select>

                <label>Timer</label>
                <select
                  value={room.settings.timerSeconds}
                  disabled={!isHost}
                  onChange={(e) => updateSetting({ timerSeconds: Number(e.target.value) as 30 | 45 | 60 })}
                >
                  <option value={30}>30s</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                </select>

                <label>Niveau</label>
                <select
                  value={room.settings.level}
                  disabled={!isHost}
                  onChange={(e) => updateSetting({ level: e.target.value as 'soft' | 'mid' | 'adult' })}
                >
                  <option value="soft">soft</option>
                  <option value="mid">mid</option>
                  <option value="adult">adult</option>
                </select>

                <label>Fin</label>
                <select
                  value={room.settings.gameEndMode}
                  disabled={!isHost}
                  onChange={(e) => updateSetting({ gameEndMode: e.target.value as 'points' | 'rounds' })}
                >
                  <option value="points">Points</option>
                  <option value="rounds">Manches</option>
                </select>
              </div>

              {isHost && (
                <button className="btn" onClick={() => socket.emit('game:start')} disabled={room.players.length < 3}>
                  Lancer la partie
                </button>
              )}
            </>
          )}

          {room.phase === 'round' && (
            <>
              <h3>Manche {room.roundIndex}</h3>
              <p>
                <strong>Sujet:</strong> {room.currentSubject}
              </p>
              <p>
                <strong>Template:</strong> {room.currentTemplate}
              </p>
              <p>
                Timer: <strong>{roundTimer}s</strong>
              </p>

              {isJudge ? (
                <p>Tu es le juge cette manche: tu ne proposes pas de reponse.</p>
              ) : (
                <>
                  <label>Ta reponse</label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={4}
                    placeholder={room.holesCount === 2 ? 'texte1 | texte2' : 'texte'}
                    disabled={submitted}
                  />
                  <div className="row">
                    <button
                      className="btn"
                      onClick={() => {
                        socket.emit('round:submit', { answer });
                        setSubmitted(true);
                      }}
                      disabled={!shouldAnswer || submitted}
                    >
                      {submitted ? 'Reponse envoyee' : 'Envoyer'}
                    </button>
                    {(isHost || isJudge) && (
                      <button className="btn secondary" onClick={() => socket.emit('round:lock')}>
                        Verrouiller les reponses
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {room.phase === 'reveal' && (
            <>
              <h3>Revelation</h3>
              {room.settings.winMode === 'judge' ? (
                <p>{isJudge ? 'Tu es le juge: choisis la reponse gagnante.' : 'Le juge choisit le gagnant.'}</p>
              ) : (
                <p>{isCurrentVoter ? 'A toi de voter.' : 'Attente du votant en cours.'}</p>
              )}

              <div className="answers">
                {room.revealResponses.map((r) => (
                  <button
                    key={r.id}
                    className="answer"
                    disabled={
                      room.settings.winMode === 'judge'
                        ? !isJudge
                        : !isCurrentVoter
                    }
                    onClick={() => {
                      if (room.settings.winMode === 'judge') socket.emit('reveal:judge_pick', { responseId: r.id });
                      else socket.emit('reveal:vote', { responseId: r.id });
                    }}
                  >
                    {r.filledText}
                  </button>
                ))}
              </div>
            </>
          )}

          {(room.phase === 'scoreboard' || room.phase === 'finished') && (
            <>
              <h3>{room.phase === 'finished' ? 'Partie terminee' : 'Scoreboard'}</h3>
              <p>
                Gagnant manche: {room.players.find((p) => p.id === room.lastWinnerId)?.name ?? '-'}
              </p>
              {room.phase === 'finished' && (
                <p>
                  Gagnant partie: <strong>{room.players.find((p) => p.id === room.winnerId)?.name ?? '-'}</strong>
                </p>
              )}

              {room.players.map((p) => (
                <div key={p.id} className="player-row">
                  <span>{p.name}</span>
                  <strong>{room.scores[p.id] ?? 0}</strong>
                </div>
              ))}

              {isHost && room.phase === 'scoreboard' && (
                <button className="btn" onClick={() => socket.emit('round:next')}>
                  Manche suivante
                </button>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
