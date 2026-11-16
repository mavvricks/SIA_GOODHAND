/**
 * Normalizes Philippine phone numbers to RFC format (+63...)
 * Accepts:
 *  - 09XXXXXXXXX (11 digits mobile) -> +639XXXXXXXXX
 *  - 02XXXXXXXX (10 digits landline) -> +632XXXXXXXX
 *  - +639XXXXXXXXX or +632XXXXXXXX
 */
export function normalizePhilippinePhone(rawPhone: string): string {
  const cleaned = rawPhone.trim().replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('09') && cleaned.length === 11) {
    return '+63' + cleaned.substring(1);
  }

  if (cleaned.startsWith('02') && cleaned.length === 10) {
    return '+63' + cleaned.substring(1);
  }

  if (cleaned.startsWith('+63')) {
    const digitsAfter = cleaned.substring(3);
    if (/^[0-9]{8,10}$/.test(digitsAfter)) {
      return cleaned;
    }
  }

  return cleaned; // return as-is for downstream schema validation failure
}
