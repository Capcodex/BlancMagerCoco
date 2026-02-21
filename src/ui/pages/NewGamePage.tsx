import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

const MIN = 3;
const MAX = 10;

export function NewGamePage() {
  const navigate = useNavigate();
  const { startNewGame } = useGame();
  const [players, setPlayers] = useState<string[]>(['', '', '']);
  const [error, setError] = useState('');

  const updatePlayer = (index: number, value: string) => {
    const next = [...players];
    next[index] = value;
    setPlayers(next);
  };

  const addPlayer = () => {
    if (players.length < MAX) setPlayers([...players, '']);
  };

  const removePlayer = () => {
    if (players.length > MIN) setPlayers(players.slice(0, -1));
  };

  const onStart = async () => {
    const clean = players.map((p) => p.trim()).filter(Boolean);
    if (clean.length < MIN || clean.length > MAX) {
      setError('Il faut entre 3 et 10 noms valides.');
      return;
    }
    await startNewGame(clean);
    navigate('/round');
  };

  return (
    <section className="stack">
      <div className="card">
        <h2>Nouvelle partie</h2>
        <p>Ajoute les joueurs (3 a 10), puis lance la premiere manche.</p>
      </div>

      <div className="card stack">
        {players.map((name, i) => (
          <input
            key={i}
            value={name}
            onChange={(e) => updatePlayer(i, e.target.value)}
            placeholder={`Joueur ${i + 1}`}
          />
        ))}
        <div className="actions">
          <button className="btn secondary" onClick={addPlayer}>
            + Joueur
          </button>
          <button className="btn secondary" onClick={removePlayer}>
            - Joueur
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn" onClick={onStart}>
        Demarrer
      </button>
    </section>
  );
}
