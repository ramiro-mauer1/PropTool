/**
 * Normalizes an Argentine phone number to the international mobile format
 * WhatsApp expects: 549 + area code + subscriber number, without the
 * domestic "0" prefix or the mobile "15" — 10 national digits in total.
 *
 *   "01156104940"       → "5491156104940"
 *   "11 15 5610-4940"   → "5491156104940"
 *   "+54 9 11 5610 4940"→ "5491156104940"
 *
 * Returns null when the input can't be confidently mapped to 10 national
 * digits; callers then offer a plain call instead of a WhatsApp link.
 */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;

  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);

  // Area code (2–4 digits) + "15" + subscriber number: drop the "15".
  if (d.length === 12) {
    for (const areaLen of [2, 3, 4]) {
      if (d.slice(areaLen, areaLen + 2) === '15') {
        d = d.slice(0, areaLen) + d.slice(areaLen + 2);
        break;
      }
    }
  }

  return d.length === 10 ? `549${d}` : null;
}

/** Digits-only form used to match an existing Contact by phone. */
export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}
