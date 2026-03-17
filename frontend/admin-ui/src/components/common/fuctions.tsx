

// ── Password strength ─────────────────────────────────────────────────────────
export function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let s = 0;
  if (pw.length >= 8)          s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const MAP = [
    { score: 1, label: 'Weak',   color: '#d73027' },
    { score: 2, label: 'Fair',   color: '#fc8d59' },
    { score: 3, label: 'Good',   color: '#91cf60' },
    { score: 4, label: 'Strong', color: '#1a9850' },
  ];
  return MAP[s - 1] ?? { score: 0, label: 'Weak', color: '#d73027' };
}