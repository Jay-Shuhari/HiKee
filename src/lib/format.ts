import type { Att, Chat } from '../data/types';

export const hm = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const sameDay = (a: number | Date, b: number | Date) => new Date(a).toDateString() === new Date(b).toDateString();

export function dayLabel(t: number) {
  const n = new Date();
  if (sameDay(t, n)) return 'Today';
  const y = new Date(n);
  y.setDate(n.getDate() - 1);
  if (sameDay(t, y)) return 'Yesterday';
  return new Date(t).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export function listTime(t: number) {
  const n = new Date();
  if (sameDay(t, n)) return hm(t);
  const y = new Date(n);
  y.setDate(n.getDate() - 1);
  if (sameDay(t, y)) return 'Yesterday';
  if (n.getTime() - t < 6 * 864e5) return new Date(t).toLocaleDateString([], { weekday: 'short' });
  return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export const mmss = (s: number) => {
  s = Math.max(0, Math.round(s || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
export const size = (b = 0) => (b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
export const extOf = (n: string) => (n.includes('.') ? n.split('.').pop()! : 'file').slice(0, 4).toUpperCase();
export const EXTC: Record<string, string> = {
  PDF: '#e5484d', DOC: '#2f6fed', DOCX: '#2f6fed', XLS: '#1f9d55', XLSX: '#1f9d55', CSV: '#1f9d55',
  PPT: '#e8730c', PPTX: '#e8730c', ZIP: '#6b7280', TXT: '#6b7280',
};
export const extColor = (name: string) => EXTC[extOf(name)] || '#6b7280';
export const isPdf = (a: Att) => a.type === 'doc' && /\.pdf$/i.test(a.name);
export const docKind = (a: Att): 'sheet' | 'slides' | 'page' | 'file' => {
  const e = extOf(a.name);
  return /^(XLSX|XLS|CSV|ODS)$/.test(e) ? 'sheet'
    : /^(PPTX|PPT|KEY|ODP)$/.test(e) ? 'slides'
    : /^(PDF|DOCX|DOC|TXT|MD|RTF|ODT)$/.test(e) ? 'page' : 'file';
};
export const hasCard = (a: Att) => a.type === 'doc' && (!!a.pv || !!a.thumb || !!a.thumbKey || docKind(a) !== 'file');

export function status(c: Chat) {
  if (c.online) return 'Online';
  if (!c.seen) return 'Offline';
  const d = dayLabel(c.seen);
  return 'Last seen ' + (d === 'Today' ? 'today' : d === 'Yesterday' ? 'yesterday' : d) + ' at ' + hm(c.seen);
}

export function hash(s: string) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function rng(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flat avatar palette (no gradients). */
export const AVATAR_COLORS = ['#e8505b', '#2a9d8f', '#4f5bd5', '#e08e0b', '#8456d8', '#d6336c', '#3b82c4', '#1f9d55', '#c2410c', '#0e7490'];
export const colorFor = (id: string) => AVATAR_COLORS[hash(id) % AVATAR_COLORS.length];

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
export const firstName = (name: string) => name.split(' ')[0];

export const uuid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
