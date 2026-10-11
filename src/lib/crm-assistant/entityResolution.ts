import { prisma } from '@/lib/db';
import type { Contact, Property } from '@prisma/client';

// Fuzzy match extracted names/references against existing records. Never
// auto-picks unless there's a single, clearly-best candidate — anything else
// gets surfaced to the agent on the confirmation card to disambiguate.

const AUTO_SELECT_THRESHOLD = 0.82;
const AUTO_SELECT_MARGIN = 0.12; // best must beat runner-up by this much
const CANDIDATE_THRESHOLD = 0.35;
const MAX_CANDIDATES = 5;

export interface ResolutionCandidate<T> {
  record: T;
  score: number; // 0-1
}

export interface ResolutionResult<T> {
  /** Set only when a single candidate is confidently the right one. */
  autoSelected: T | null;
  /** Ranked candidates for the agent to pick from (includes autoSelected, if any, as [0]). */
  candidates: ResolutionCandidate<T>[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function bigrams(s: string): Set<string> {
  const padded = ` ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 1; i++) set.add(padded.slice(i, i + 2));
  return set;
}

/** Dice coefficient over character bigrams of two single tokens — cheap, dependency-free fuzzy match. */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let overlap = 0;
  Array.from(ba).forEach((g) => {
    if (bb.has(g)) overlap++;
  });
  const denom = ba.size + bb.size;
  return denom === 0 ? 0 : (2 * overlap) / denom;
}

/**
 * Word-level similarity: for each token in the QUERY, take its best fuzzy
 * match among the candidate's tokens, then average over the query's token
 * count only. Averaging over the query (not the candidate) is deliberate —
 * it means a partial mention like "Ivan" scores identically against every
 * "Ivan <surname>" record instead of favoring whichever surname happens to
 * be shorter (a real bug an earlier char-level version had: pure Dice over
 * the whole string let string length skew the score enough to trigger a
 * false-confident auto-select between two same-first-name contacts).
 */
function similarity(query: string, candidateLabel: string): number {
  const nq = normalize(query);
  const nc = normalize(candidateLabel);
  if (!nq || !nc) return 0;
  if (nq === nc) return 1;

  const qTokens = nq.split(' ').filter(Boolean);
  const cTokens = nc.split(' ').filter(Boolean);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  const perTokenScores = qTokens.map((qt) => Math.max(...cTokens.map((ct) => tokenSimilarity(qt, ct))));
  return perTokenScores.reduce((sum, v) => sum + v, 0) / perTokenScores.length;
}

function rank<T>(query: string, records: T[], getLabel: (r: T) => string): ResolutionResult<T> {
  const scored = records
    .map((record) => ({ record, score: similarity(query, getLabel(record)) }))
    .filter((c) => c.score >= CANDIDATE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  const [best, runnerUp] = scored;
  const autoSelected =
    best && best.score >= AUTO_SELECT_THRESHOLD && (!runnerUp || best.score - runnerUp.score >= AUTO_SELECT_MARGIN)
      ? best.record
      : null;

  return { autoSelected, candidates: scored };
}

export async function resolveContact(name: string, agent?: string | null): Promise<ResolutionResult<Contact>> {
  if (!name.trim()) return { autoSelected: null, candidates: [] };

  const contacts = await prisma.contact.findMany({
    where: agent ? { assignedAgent: agent } : undefined,
    take: 500,
  });
  return rank(name, contacts, (c) => c.name);
}

export async function resolveProperty(reference: string): Promise<ResolutionResult<Property>> {
  if (!reference.trim()) return { autoSelected: null, candidates: [] };

  const properties = await prisma.property.findMany({ take: 500 });
  return rank(reference, properties, (p) => p.addressOrZone);
}
