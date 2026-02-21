import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentPack, Level, SubjectCard, TemplateCard } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidatePackPaths = [
  path.resolve(process.cwd(), 'resources/packs/core.json'),
  path.resolve(process.cwd(), '../../resources/packs/core.json'),
  path.resolve(here, '../../../resources/packs/core.json')
];

const packPath = candidatePackPaths.find((p) => fs.existsSync(p));
if (!packPath) {
  throw new Error(
    `core.json introuvable. Checked: ${candidatePackPaths.join(', ')}`
  );
}

const raw = fs.readFileSync(packPath, 'utf-8');
const pack = JSON.parse(raw) as ContentPack;

function filterByLevelAndTags<T extends { level: Level; tags: string[] }>(
  cards: T[],
  level: Level,
  tags: string[]
): T[] {
  const levelMatches = cards.filter((c) => c.level === level);
  const strict = tags.length
    ? levelMatches.filter((c) => tags.every((t) => c.tags.includes(t)))
    : levelMatches;

  if (strict.length) return strict;
  if (levelMatches.length) return levelMatches;

  const tagFallback = tags.length
    ? cards.filter((c) => tags.every((t) => c.tags.includes(t)))
    : cards;

  return tagFallback.length ? tagFallback : cards;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function nextCards(
  level: Level,
  tags: string[],
  usedSubjectIds: Set<string>,
  usedTemplateIds: Set<string>
): { subject: SubjectCard; template: TemplateCard } {
  const subjectsPool = filterByLevelAndTags(
    pack.subjects.filter((s) => !usedSubjectIds.has(s.id)),
    level,
    tags
  );
  const templatesPool = filterByLevelAndTags(
    pack.templates.filter((t) => !usedTemplateIds.has(t.id)),
    level,
    tags
  );

  const subject = pickRandom(subjectsPool.length ? subjectsPool : pack.subjects);
  const template = pickRandom(templatesPool.length ? templatesPool : pack.templates);

  usedSubjectIds.add(subject.id);
  usedTemplateIds.add(template.id);

  return { subject, template };
}

export function fillTemplate(template: string, answer: string): string {
  const parts = answer.split('|').map((p) => p.trim());
  let i = 0;
  return template.replace(/___/g, () => parts[i++] || '...');
}
