export function normalizeNigerianPhone(input: string): string {
  const cleaned = input.replace(/[^\d+]/g, '').trim();
  if (/^\+234\d{10}$/.test(cleaned)) return cleaned;
  if (/^234\d{10}$/.test(cleaned)) return `+${cleaned}`;
  if (/^0\d{10}$/.test(cleaned)) return `+234${cleaned.slice(1)}`;
  if (/^\d{10}$/.test(cleaned)) return `+234${cleaned}`;
  throw new Error('Enter a valid Nigerian phone number.');
}

export function maskPhone(phone: string): string {
  const normalized = phone.replace(/\s/g, '');
  if (normalized.length < 8) return normalized;
  return `${normalized.slice(0, 7)} *** ${normalized.slice(-4)}`;
}
