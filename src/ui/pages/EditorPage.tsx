import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ContentManager } from '../../content/ContentManager';
import { ContentPack, SubjectCard, TemplateCard } from '../../shared/types';
import { useGame } from '../context/GameContext';

export function EditorPage() {
  const { packs, getPack, savePack } = useGame();
  const [selectedPackId, setSelectedPackId] = useState('core');
  const [pack, setPack] = useState<ContentPack | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load('core');
  }, []);

  const load = async (id: string) => {
    setSelectedPackId(id);
    const p = await getPack(id);
    setPack(p);
    setError('');
  };

  const addSubject = () => {
    if (!pack) return;
    const subject: SubjectCard = {
      id: uuidv4(),
      text: 'Nouveau sujet',
      level: 'soft',
      tags: []
    };
    setPack({ ...pack, subjects: [subject, ...pack.subjects] });
  };

  const addTemplate = () => {
    if (!pack) return;
    const template: TemplateCard = {
      id: uuidv4(),
      text: 'Mon template ___',
      level: 'soft',
      tags: [],
      holesCount: 1
    };
    setPack({ ...pack, templates: [template, ...pack.templates] });
  };

  const updateSubject = (index: number, partial: Partial<SubjectCard>) => {
    if (!pack) return;
    const next = [...pack.subjects];
    next[index] = { ...next[index], ...partial };
    setPack({ ...pack, subjects: next });
  };

  const updateTemplate = (index: number, partial: Partial<TemplateCard>) => {
    if (!pack) return;
    const next = [...pack.templates];
    next[index] = { ...next[index], ...partial };
    setPack({ ...pack, templates: next });
  };

  const removeSubject = (index: number) => {
    if (!pack) return;
    const next = [...pack.subjects];
    next.splice(index, 1);
    setPack({ ...pack, subjects: next });
  };

  const removeTemplate = (index: number) => {
    if (!pack) return;
    const next = [...pack.templates];
    next.splice(index, 1);
    setPack({ ...pack, templates: next });
  };

  const onSave = async () => {
    if (!pack) return;
    const invalid = pack.templates.find((t) => !ContentManager.validateTemplate(t.text, t.holesCount));
    if (invalid) {
      setError(`Template invalide: ${invalid.text}`);
      return;
    }
    await savePack(pack);
    setError('Sauvegarde OK');
  };

  if (!pack) {
    return (
      <section className="stack">
        <div className="card">Choisis un pack a editer.</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="card stack">
        <h2>Editeur de contenu</h2>
        <label>Pack</label>
        <select value={selectedPackId} onChange={(e) => load(e.target.value)}>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label>Nom</label>
        <input value={pack.name} onChange={(e) => setPack({ ...pack, name: e.target.value })} />

        <label>Version</label>
        <input value={pack.version} onChange={(e) => setPack({ ...pack, version: e.target.value })} />

        <div className="actions">
          <button className="btn secondary" onClick={addSubject}>
            + Sujet
          </button>
          <button className="btn secondary" onClick={addTemplate}>
            + Template
          </button>
          <button className="btn" onClick={onSave}>
            Sauvegarder le pack
          </button>
        </div>
        {error && <p>{error}</p>}
      </div>

      <div className="card stack">
        <h3>Sujets ({pack.subjects.length})</h3>
        {pack.subjects.slice(0, 30).map((s, i) => (
          <div className="editor-row" key={s.id}>
            <input value={s.text} onChange={(e) => updateSubject(i, { text: e.target.value })} />
            <select
              value={s.level}
              onChange={(e) => updateSubject(i, { level: e.target.value as 'soft' | 'mid' | 'adult' })}
            >
              <option value="soft">soft</option>
              <option value="mid">mid</option>
              <option value="adult">adult</option>
            </select>
            <input
              value={s.tags.join(',')}
              onChange={(e) => updateSubject(i, { tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
              placeholder="tags separes par virgule"
            />
            <button className="btn danger" onClick={() => removeSubject(i)}>
              X
            </button>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h3>Templates ({pack.templates.length})</h3>
        {pack.templates.slice(0, 80).map((t, i) => (
          <div className="editor-row" key={t.id}>
            <input value={t.text} onChange={(e) => updateTemplate(i, { text: e.target.value })} />
            <select
              value={t.holesCount}
              onChange={(e) => updateTemplate(i, { holesCount: Number(e.target.value) as 1 | 2 })}
            >
              <option value={1}>1 trou</option>
              <option value={2}>2 trous</option>
            </select>
            <select
              value={t.level}
              onChange={(e) => updateTemplate(i, { level: e.target.value as 'soft' | 'mid' | 'adult' })}
            >
              <option value="soft">soft</option>
              <option value="mid">mid</option>
              <option value="adult">adult</option>
            </select>
            <input
              value={t.tags.join(',')}
              onChange={(e) => updateTemplate(i, { tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
              placeholder="tags"
            />
            <button className="btn danger" onClick={() => removeTemplate(i)}>
              X
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
