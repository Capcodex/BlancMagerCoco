import { NavLink, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { NewGamePage } from './pages/NewGamePage';
import { RoundPage } from './pages/RoundPage';
import { RevealPage } from './pages/RevealPage';
import { ScoreboardPage } from './pages/ScoreboardPage';
import { PacksPage } from './pages/PacksPage';
import { EditorPage } from './pages/EditorPage';
import { SettingsPage } from './pages/SettingsPage';

const links = [
  ['/', 'Accueil'],
  ['/new-game', 'Nouvelle partie'],
  ['/round', 'Manche'],
  ['/reveal', 'Revelation'],
  ['/scoreboard', 'Scoreboard'],
  ['/packs', 'Packs'],
  ['/editor', 'Editeur'],
  ['/settings', 'Parametres']
];

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Texte a trous</h1>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/new-game" element={<NewGamePage />} />
          <Route path="/round" element={<RoundPage />} />
          <Route path="/reveal" element={<RevealPage />} />
          <Route path="/scoreboard" element={<ScoreboardPage />} />
          <Route path="/packs" element={<PacksPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
