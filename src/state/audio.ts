/* Voice-note playback. One note plays at a time; the waveform, timer, heard state and the
   level-reactive ring are painted straight onto the registered DOM nodes each frame. */
import type { Att } from '../data/types';
import { NB } from '../lib/files';
import { hash, mmss, rng } from '../lib/format';

interface Live { key: string; a: Att; el: HTMLAudioElement | null; t: number; dur: number; raf: number; last: number; playing: boolean; an: AnalyserNode | null; lv: number }
const A: Live = { key: '', a: {} as Att, el: null, t: 0, dur: 0, raf: 0, last: 0, playing: false, an: null, lv: 0 };
const buf = new Uint8Array(512);
let actx: AudioContext | null = null;
let resolveUrl: (key: string) => Promise<string> = async (k) => k;
export const setUrlResolver = (f: (key: string) => Promise<string>) => { resolveUrl = f; };

/** Heard state and furthest position, per attachment key (survives re-renders). */
const heard = new Map<string, { heard: boolean; maxP: number }>();
export const heardOf = (key: string) => heard.get(key) || { heard: false, maxP: 0 };

export function peaksFor(a: Att, key: string) {
  if (!a.peaks) {
    const R = rng(hash(key));
    a.peaks = Array.from({ length: NB }, (_, i) => 0.18 + R() * 0.82 * (0.5 + 0.5 * Math.sin(i / 3 + R())));
  }
  return a.peaks;
}

function level() {
  if (A.an) {
    A.an.getByteTimeDomainData(buf);
    let s = 0;
    for (const x of buf) { const v = (x - 128) / 128; s += v * v; }
    return Math.min(1, Math.sqrt(s / buf.length) * 4.5);
  }
  const pk = A.a.peaks || [], i = Math.min(pk.length - 1, Math.floor((A.t / A.dur) * pk.length));
  return (pk[i] || 0.3) * (0.7 + 0.3 * Math.random());
}

function paint() {
  if (!A.key) return;
  const h = heard.get(A.key) || { heard: false, maxP: 0 };
  const p = A.dur ? A.t / A.dur : 0, live = A.playing;
  if (live) { A.lv += (level() - A.lv) * 0.5; h.maxP = Math.max(h.maxP, p); } else A.lv = 0;
  heard.set(A.key, h);
  const idx = Math.floor(p * NB);
  document.querySelectorAll<HTMLElement>(`[data-aud="${CSS.escape(A.key)}"]`).forEach((n) => {
    const w = n.querySelector<HTMLElement>('.wave')!;
    w.style.setProperty('--p', p * 100 + '%');
    w.style.setProperty('--h', h.maxP * 100 + '%');
    n.style.setProperty('--lv', A.lv.toFixed(3));
    n.classList.toggle('playing', live);
    n.classList.toggle('heard', h.heard);
    n.querySelector<HTMLElement>('.hd')!.title = h.heard ? 'Heard' : 'Not played yet';
    n.querySelectorAll('.bars').forEach((layer) => {
      const bs = layer.children as HTMLCollectionOf<HTMLElement>;
      for (let j = 0; j < bs.length; j++) { const d = Math.abs(j - idx); bs[j].style.transform = live && d < 4 ? `scaleY(${(1 + A.lv * 1.5 * (1 - d / 4)).toFixed(3)})` : ''; }
    });
    n.querySelector('.at')!.textContent = mmss(live || A.t ? A.t : A.dur);
    n.querySelector('.ap')!.setAttribute('aria-label', live ? 'Pause' : 'Play voice message');
  });
}

function tick(ts: number) {
  if (!A.playing) return;
  if (A.el) A.t = A.el.currentTime; else { A.t += (ts - A.last) / 1000; A.last = ts; }
  if (A.t >= A.dur) { finish(); return; }
  paint();
  A.raf = requestAnimationFrame(tick);
}
function finish() {
  A.playing = false;
  const h = heardOf(A.key); heard.set(A.key, { ...h, maxP: 1 });
  A.t = 0; paint();
}

export function stopAudio() {
  if (!A.key) return;
  A.playing = false; cancelAnimationFrame(A.raf); A.el?.pause(); A.t = 0; paint();
  A.key = ''; A.el = null; A.an = null;
}

async function load(key: string, a: Att) {
  stopAudio();
  A.key = key; A.a = a; peaksFor(a, key); A.dur = a.dur || 1; A.t = 0; A.an = null;
  let src = a.src;
  if (!src && a.key) { try { src = await resolveUrl(a.key); } catch { src = undefined; } }
  if (A.key !== key) return;
  A.el = src ? new Audio(src) : null;
  if (A.el) {
    A.el.crossOrigin = 'anonymous';
    A.el.onended = finish;
    A.el.onloadedmetadata = () => { if (A.el && isFinite(A.el.duration) && A.el.duration > 0) A.dur = A.el.duration; };
    try {
      actx = actx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      actx.resume?.();
      const node = actx.createMediaElementSource(A.el), an = actx.createAnalyser();
      an.fftSize = 512; node.connect(an); an.connect(actx.destination); A.an = an;
    } catch { A.an = null; }
  }
}

export async function toggleAudio(key: string, a: Att, onBlocked?: () => void) {
  if (A.key !== key) await load(key, a);
  if (A.key !== key) return;
  A.playing = !A.playing;
  if (A.playing) {
    heard.set(key, { ...heardOf(key), heard: true });
    if (A.el) {
      A.el.currentTime = A.t;
      A.el.play().catch(() => { A.playing = false; paint(); onBlocked?.(); });
    }
    A.last = performance.now();
    A.raf = requestAnimationFrame(tick);
  } else { A.el?.pause(); cancelAnimationFrame(A.raf); }
  paint();
}

export async function seekAudio(key: string, a: Att, pct: number) {
  if (A.key !== key) await toggleAudio(key, a);
  A.t = Math.max(0, Math.min(1, pct)) * A.dur;
  if (A.el) A.el.currentTime = A.t;
  paint();
}

/** Repaint a freshly mounted node if it's the one playing. */
export function repaint(key: string) { if (A.key === key) paint(); }
