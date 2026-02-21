import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export function ScoreboardPage() {
  const navigate = useNavigate();
  const { players, scores, lastWinnerId, startNextRound, isGameOver } = useGame();

  const winnerName = players.find((p) => p.id === lastWinnerId)?.name ?? '-';

  const nextRound = async () => {
    await startNextRound();
    navigate('/round');
  };

  return (
    <section className="stack">
      <div className="card">
        <h2>Scoreboard</h2>
        <p>Gagnant de la manche: {winnerName}</p>
      </div>

      <div className="card">
        {players.map((p) => (
          <div key={p.id} className="score-row">
            <span>{p.name}</span>
            <strong>{scores[p.id] ?? 0} pt</strong>
          </div>
        ))}
      </div>

      <div className="actions">
        {!isGameOver ? (
          <button className="btn" onClick={nextRound}>
            Manche suivante
          </button>
        ) : (
          <button className="btn" onClick={() => navigate('/new-game')}>
            Nouvelle partie
          </button>
        )}
      </div>
    </section>
  );
}
