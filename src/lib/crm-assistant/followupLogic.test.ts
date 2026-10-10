import { describe, expect, it } from 'vitest';
import { computeFollowupDueDate, URGENCY_DELAY_DAYS } from './followupLogic';

describe('followupLogic', () => {
  it('maps alta urgency to 2-3 days out', () => {
    const from = new Date('2026-01-01T12:00:00Z');
    const due = computeFollowupDueDate('alta', from);
    const diffDays = Math.round((due.getTime() - from.getTime()) / 86_400_000);
    expect(diffDays).toBeGreaterThanOrEqual(URGENCY_DELAY_DAYS.alta.min);
    expect(diffDays).toBeLessThanOrEqual(URGENCY_DELAY_DAYS.alta.max);
  });

  it('maps media urgency to 5-7 days out', () => {
    const from = new Date('2026-01-01T12:00:00Z');
    const due = computeFollowupDueDate('media', from);
    const diffDays = Math.round((due.getTime() - from.getTime()) / 86_400_000);
    expect(diffDays).toBeGreaterThanOrEqual(URGENCY_DELAY_DAYS.media.min);
    expect(diffDays).toBeLessThanOrEqual(URGENCY_DELAY_DAYS.media.max);
  });

  it('maps baja urgency to 15-20 days out', () => {
    const from = new Date('2026-01-01T12:00:00Z');
    const due = computeFollowupDueDate('baja', from);
    const diffDays = Math.round((due.getTime() - from.getTime()) / 86_400_000);
    expect(diffDays).toBeGreaterThanOrEqual(URGENCY_DELAY_DAYS.baja.min);
    expect(diffDays).toBeLessThanOrEqual(URGENCY_DELAY_DAYS.baja.max);
  });

  it('is strictly increasing in urgency delay: alta < media < baja', () => {
    const from = new Date('2026-01-01T12:00:00Z');
    const alta = computeFollowupDueDate('alta', from).getTime();
    const media = computeFollowupDueDate('media', from).getTime();
    const baja = computeFollowupDueDate('baja', from).getTime();
    expect(alta).toBeLessThan(media);
    expect(media).toBeLessThan(baja);
  });
});
