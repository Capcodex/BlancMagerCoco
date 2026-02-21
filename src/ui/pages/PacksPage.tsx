import { useEffect } from 'react';
import { useGame } from '../context/GameContext';

export function PacksPage() {
  const { packs, settings, importPack, exportPack, deletePack, setPackActive, listPacks } = useGame();

  useEffect(() => {
    listPacks();
  }, []);

  if (!settings) return <div className="card">Chargement...</div>;

  return (
    <section className="stack">
      <div className="card">
        <h2>Packs</h2>
        <div className="actions">
          <button className="btn" onClick={importPack}>
            Importer JSON
          </button>
        </div>
      </div>

      <div className="stack">
        {packs.map((p) => {
          const active = settings.activePackIds.includes(p.id);
          return (
            <div className="card pack-row" key={p.id}>
              <div>
                <h3>{p.name}</h3>
                <p>
                  {p.subjectCount} sujets - {p.templateCount} templates
                </p>
                <small>{p.id}</small>
              </div>
              <div className="actions">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setPackActive(p.id, e.target.checked)}
                    disabled={p.id === 'core'}
                  />
                  Actif
                </label>
                <button className="btn secondary" onClick={() => exportPack(p.id)}>
                  Export
                </button>
                {p.id !== 'core' && (
                  <button className="btn danger" onClick={() => deletePack(p.id)}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
