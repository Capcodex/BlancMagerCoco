import { useState } from 'react';
import { useGame } from '../context/GameContext';

export function SettingsPage() {
  const { settings, availableTags, saveSettings } = useGame();
  const [saving, setSaving] = useState(false);

  if (!settings) return <div className="card">Chargement...</div>;

  const toggleTag = (tag: string) => {
    const next = settings.activeTags.includes(tag)
      ? settings.activeTags.filter((t) => t !== tag)
      : [...settings.activeTags, tag];
    saveSettings({ ...settings, activeTags: next });
  };

  const onSave = async () => {
    setSaving(true);
    await saveSettings(settings);
    setSaving(false);
  };

  return (
    <section className="stack">
      <div className="card">
        <h2>Parametres</h2>

        <label>Mode gagnant</label>
        <select
          value={settings.winMode}
          onChange={(e) => saveSettings({ ...settings, winMode: e.target.value as 'judge' | 'vote' })}
        >
          <option value="judge">Juge</option>
          <option value="vote">Vote</option>
        </select>

        <label>Timer d'ecriture</label>
        <select
          value={settings.timerSeconds}
          onChange={(e) => saveSettings({ ...settings, timerSeconds: Number(e.target.value) as 30 | 45 | 60 })}
        >
          <option value={30}>30s</option>
          <option value={45}>45s</option>
          <option value={60}>60s</option>
        </select>

        <label>Niveau</label>
        <select
          value={settings.level}
          onChange={(e) => saveSettings({ ...settings, level: e.target.value as 'soft' | 'mid' | 'adult' })}
        >
          <option value="soft">soft</option>
          <option value="mid">mid</option>
          <option value="adult">adult</option>
        </select>

        <label>Fin de partie</label>
        <select
          value={settings.gameEndMode}
          onChange={(e) => saveSettings({ ...settings, gameEndMode: e.target.value as 'points' | 'rounds' })}
        >
          <option value="points">X points</option>
          <option value="rounds">N manches</option>
        </select>

        {settings.gameEndMode === 'points' ? (
          <input
            type="number"
            min={1}
            max={50}
            value={settings.targetPoints}
            onChange={(e) => saveSettings({ ...settings, targetPoints: Number(e.target.value) })}
          />
        ) : (
          <input
            type="number"
            min={1}
            max={100}
            value={settings.targetRounds}
            onChange={(e) => saveSettings({ ...settings, targetRounds: Number(e.target.value) })}
          />
        )}

        <label className="switch">
          <input
            type="checkbox"
            checked={settings.hideInputMode}
            onChange={(e) => saveSettings({ ...settings, hideInputMode: e.target.checked })}
          />
          Masquer la saisie entre joueurs
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={settings.saveHistory}
            onChange={(e) => saveSettings({ ...settings, saveHistory: e.target.checked })}
          />
          Sauvegarder l'historique
        </label>

        <div>
          <h3>Tags actifs</h3>
          <div className="tags">
            {availableTags.map((tag) => (
              <button
                key={tag}
                className={settings.activeTags.includes(tag) ? 'tag active' : 'tag'}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <button className="btn" onClick={onSave} disabled={saving}>
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </section>
  );
}
