import { ContentPack, Level, RoundCards, SubjectCard, TemplateCard } from '../shared/types';

interface SelectionInput {
  packs: ContentPack[];
  level: Level;
  activeTags: string[];
  usedSubjectIds: Set<string>;
  usedTemplateIds: Set<string>;
}

export class ContentManager {
  static collectTags(packs: ContentPack[]): string[] {
    const values = new Set<string>();
    for (const pack of packs) {
      for (const card of pack.subjects) {
        for (const tag of card.tags) values.add(tag);
      }
      for (const card of pack.templates) {
        for (const tag of card.tags) values.add(tag);
      }
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }

  static nextRoundCards(input: SelectionInput): RoundCards {
    const subjects = this.filterSubjects(input.packs, input.level, input.activeTags, input.usedSubjectIds);
    const templates = this.filterTemplates(input.packs, input.level, input.activeTags, input.usedTemplateIds);

    if (!subjects.length || !templates.length) {
      throw new Error('Pas assez de contenu pour lancer une manche.');
    }

    const subject = this.pickRandom(subjects);
    const template = this.pickRandom(templates);

    return { subject, template };
  }

  static validateTemplate(text: string, holesCount: number): boolean {
    const count = (text.match(/___/g) ?? []).length;
    return count === holesCount && (holesCount === 1 || holesCount === 2);
  }

  static fillTemplate(template: string, answer: string): string {
    const parts = answer.split('|').map((p) => p.trim());
    let index = 0;
    return template.replace(/___/g, () => parts[index++] || '...');
  }

  private static filterSubjects(
    packs: ContentPack[],
    level: Level,
    activeTags: string[],
    usedIds: Set<string>
  ): SubjectCard[] {
    const all = packs.flatMap((p) => p.subjects).filter((s) => !usedIds.has(s.id));
    return this.withFallback(all, level, activeTags);
  }

  private static filterTemplates(
    packs: ContentPack[],
    level: Level,
    activeTags: string[],
    usedIds: Set<string>
  ): TemplateCard[] {
    const all = packs.flatMap((p) => p.templates).filter((s) => !usedIds.has(s.id));
    return this.withFallback(all, level, activeTags);
  }

  private static withFallback<T extends { level: Level; tags: string[] }>(
    cards: T[],
    level: Level,
    activeTags: string[]
  ): T[] {
    const levelMatches = cards.filter((c) => c.level === level);
    const tagFilter = (pool: T[]) =>
      activeTags.length
        ? pool.filter((c) => activeTags.every((tag) => c.tags.includes(tag)))
        : pool;

    const strict = tagFilter(levelMatches);
    if (strict.length) return strict;

    const relaxedTag = levelMatches;
    if (relaxedTag.length) return relaxedTag;

    const fallbackAllLevels = tagFilter(cards);
    if (fallbackAllLevels.length) return fallbackAllLevels;

    return cards;
  }

  private static pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
