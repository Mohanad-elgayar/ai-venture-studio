export const pct = (v: number, digits = 0) => `${(Number.isFinite(v) ? v : 0).toFixed(digits)}%`;
export const num = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-GB') : '—');
export const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
export const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');
export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
