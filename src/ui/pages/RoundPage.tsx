import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

function formatTimer(value: number) {
  const m = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const s = (value % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function RoundPage() {
  const navigate = useNavigate();
  const { currentRound, players, judgeId, settings, submitAnswer, lockRound } = useGame();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPassScreen, setShowPassScreen] = useState(true);
  const [value, setValue] = useState('');
  const [timer, setTimer] = useState(settings?.timerSeconds ?? 45);

  useEffect(() => {
    if (!settings) return;
    setTimer(settings.timerSeconds);
  }, [settings]);

  useEffect(() => {
    if (!settings) return;
    const id = setInterval(() => {
      setTimer((v) => {
        if (v <= 1) {
          clearInterval(id);
          onTimeOver();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [settings, currentIndex, players, judgeId]);

  const onTimeOver = () => {
    const responders = players.filter((p) => p.id !== judgeId);
    for (let i = currentIndex; i < responders.length; i += 1) {
      submitAnswer(responders[i].id, '');
    }
    lockRound();
    navigate('/reveal');
  };

  const responders = useMemo(() => players.filter((p) => p.id !== judgeId), [players, judgeId]);
  const activePlayer = useMemo(() => responders[currentIndex], [responders, currentIndex]);
  const judgeName = useMemo(() => players.find((p) => p.id === judgeId)?.name ?? '-', [players, judgeId]);

  if (!currentRound || !settings || !players.length || responders.length < 2) {
    return <div className="card">Demarre une partie depuis l'ecran Nouvelle partie.</div>;
  }

  const onSubmit = () => {
    if (!activePlayer) return;
    submitAnswer(activePlayer.id, value.trim());
    setValue('');

    if (currentIndex + 1 >= responders.length) {
      lockRound();
      navigate('/reveal');
      return;
    }

    setCurrentIndex(currentIndex + 1);
    if (settings.hideInputMode) {
      setShowPassScreen(true);
    }
  };

  return (
    <section className="stack">
      <div className="card">
        <h2>Manche en cours</h2>
        <p className="timer">Temps restant: {formatTimer(timer)}</p>
        <p>
          <strong>Sujet:</strong> {currentRound.subject.text}
        </p>
        <p>
          <strong>Template:</strong> {currentRound.template.text}
        </p>
        <p>
          <strong>Juge:</strong> {judgeName} (ne participe pas aux reponses)
        </p>
        <p>
          {currentRound.template.holesCount === 2
            ? "2 trous: saisis 'texte1 | texte2'"
            : '1 trou: saisis une proposition'}
        </p>
      </div>

      {settings.hideInputMode && showPassScreen ? (
        <div className="card pass-screen">
          <h3>Passe le PC</h3>
          <p>Au joueur suivant: {activePlayer?.name}</p>
          <button className="btn" onClick={() => setShowPassScreen(false)}>
            Pret, afficher la saisie
          </button>
        </div>
      ) : (
        <div className="card stack">
          <h3>Tour de {activePlayer?.name}</h3>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ta reponse"
            rows={4}
            autoFocus
          />
          <button className="btn" onClick={onSubmit}>
            Verrouiller ma reponse
          </button>
        </div>
      )}
    </section>
  );
}
