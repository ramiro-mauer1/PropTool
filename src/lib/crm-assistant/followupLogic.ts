import type { Urgency } from '@prisma/client';

/**
 * Single source of truth for urgency → follow-up delay. The LLM only ever
 * returns a qualitative `urgency` label (see extraction.ts); the actual due
 * date is always computed here, so the mapping can be tuned against real
 * close-rate data without touching the extraction prompt.
 */
export const URGENCY_DELAY_DAYS: Record<Urgency, { min: number; max: number }> = {
  alta: { min: 2, max: 3 },
  media: { min: 5, max: 7 },
  baja: { min: 15, max: 20 },
};

/**
 * Picks the midpoint of the configured range (rounded down) and returns the
 * resulting due date relative to `from` (defaults to now).
 */
export function computeFollowupDueDate(urgency: Urgency, from: Date = new Date()): Date {
  const { min, max } = URGENCY_DELAY_DAYS[urgency];
  const days = Math.floor((min + max) / 2);
  const due = new Date(from);
  due.setDate(due.getDate() + days);
  return due;
}
