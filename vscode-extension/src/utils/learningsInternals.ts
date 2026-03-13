import * as fs from 'fs';
import * as path from 'path';

import type {
  LearningEvidenceStrength,
  LearningValidationState,
  LearningsIntent,
} from './learningsTypes';

const LEARNINGS_DIR = path.join('docs', 'artifacts', 'learnings');

export const CATEGORY_PREFERENCES: Record<LearningsIntent, ReadonlyArray<string>> = {
  planning: ['workflow-contract', 'memory', 'architecture', 'validation'],
  review: ['review', 'validation', 'workflow-contract', 'memory'],
  capture: ['workflow-contract', 'memory', 'review'],
};

export const DEFAULT_QUERY: Record<LearningsIntent, string> = {
  planning: 'planning decomposition implementation workflow',
  review: 'review findings validation workflow',
  capture: 'knowledge capture solved problem reusable learning',
};

export function listLearningFiles(root: string): string[] {
  const learningsDir = path.join(root, LEARNINGS_DIR);
  if (!fs.existsSync(learningsDir)) {
    return [];
  }

  return fs.readdirSync(learningsDir)
    .filter((entry) => /^LEARNING-.+\.md$/i.test(entry))
    .map((entry) => path.join(learningsDir, entry))
    .sort();
}

export function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {};
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }
  return fields;
}

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(
    `^## ${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`,
    'm',
  );
  const match = body.match(pattern);
  return match ? match[1].trim() : '';
}

export function extractFirstParagraph(section: string): string {
  const trimmed = section.trim();
  if (!trimmed) {
    return '';
  }

  const paragraph = trimmed.split(/\r?\n\r?\n/)[0];
  return paragraph.replace(/\r?\n/g, ' ').trim();
}

export function extractBullets(section: string): string[] {
  return section.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

export function tokenize(value: string): string[] {
  return value.toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

export function getEvidenceScore(value: LearningEvidenceStrength): number {
  switch (value) {
    case 'high':
      return 4;
    case 'medium':
      return 2;
    default:
      return 0;
  }
}

export function getValidationScore(value: LearningValidationState): number {
  switch (value) {
    case 'approved':
      return 4;
    case 'reviewed':
      return 2;
    case 'superseded':
    case 'archived':
      return -100;
    default:
      return 0;
  }
}

export function getRecencyScore(updatedAt: number): number {
  const ageMs = Date.now() - updatedAt;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  if (ageMs <= thirtyDaysMs) {
    return 2;
  }
  if (ageMs <= ninetyDaysMs) {
    return 1;
  }
  return 0;
}
