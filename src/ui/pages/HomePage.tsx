import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export function HomePage() {
  const { settings, packs, loading } = useGame();

  if (loading || !settings) return <div className="card">Chargement...</div>;

  return (
    <section className="stack">
      <div className="hero">
        <h2>Jeu Texte a trous</h2>
        <p>Parties locales de 3 a 10 joueurs, juge tournant, votes anonymes et packs personnalisables.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Configuration active</h3>
          <p>Mode gagnant: {settings.winMode}</p>
          <p>Timer: {settings.timerSeconds}s</p>
          <p>Niveau: {settings.level}</p>
          <p>Packs actifs: {settings.activePackIds.join(', ')}</p>
        </div>
        <div className="card">
          <h3>Contenu installe</h3>
          <p>{packs.length} pack(s) local(aux)</p>
          <p>{packs.reduce((acc, p) => acc + p.subjectCount, 0)} sujets</p>
          <p>{packs.reduce((acc, p) => acc + p.templateCount, 0)} templates</p>
        </div>
      </div>

      <div className="actions">
        <Link className="btn" to="/new-game">
          Nouvelle partie
        </Link>
        <Link className="btn secondary" to="/packs">
          Gerer les packs
        </Link>
      </div>
    </section>
  );
}
