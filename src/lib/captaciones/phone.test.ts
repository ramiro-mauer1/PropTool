import { describe, expect, it } from 'vitest';
import { toWhatsappNumber } from './phone';

describe('toWhatsappNumber', () => {
  it.each([
    ['01156104940', '5491156104940'],
    ['1156104940', '5491156104940'],
    ['11 15 5610-4940', '5491156104940'],
    ['011 15 5610 4940', '5491156104940'],
    ['+54 9 11 5610 4940', '5491156104940'],
    ['+54 11 5610 4940', '5491156104940'],
    ['0054 9 11 5610 4940', '5491156104940'],
    ['0237 15 461-2345', '5492374612345'],
    ['(0230) 4123456', '5492304123456'],
  ])('%s → %s', (raw, expected) => {
    expect(toWhatsappNumber(raw)).toBe(expected);
  });

  it.each([null, '', 'sin teléfono', '4612345', '123456789012345'])('%s → null', (raw) => {
    expect(toWhatsappNumber(raw)).toBeNull();
  });
});
