/* Turning picked/dropped files into attachments: dimensions, durations, video posters,
   waveform peaks and document previews (PDF pages, DOCX/PPTX text, XLSX/CSV rows). */
import type { Att, AttType, Preview } from '../data/types';
import { docKind, extOf } from './format';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export const NB = 34; // waveform bars
let seq = 1;

export interface Pending { id: number; a: Att; ready: Promise<unknown> }

export function kindOf(f: File): AttType {
  return f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'doc';
}

export async function peaksOf(blob: Blob): Promise<number[] | null> {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close?.();
    const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / NB)), out: number[] = [];
    for (let i = 0; i < NB; i++) {
      let s = 0;
      for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 8) s = Math.max(s, Math.abs(d[j]));
      out.push(s);
    }
    const mx = Math.max(...out, 0.01);
    return out.map((v) => Math.max(0.06, v / mx));
  } catch {
    return null;
  }
}

export function prep(f: File): Pending {
  const url = URL.createObjectURL(f), k = kindOf(f);
  const a: Att = { type: k, src: url, name: f.name, size: f.size, file: f, mime: f.type || undefined };
  let ready: Promise<unknown> = Promise.resolve();
  if (k === 'image') ready = new Promise<void>((r) => {
    const im = new Image();
    im.onload = () => { a.w = im.naturalWidth; a.h = im.naturalHeight; r(); };
    im.onerror = () => { a.w = 4; a.h = 3; r(); };
    im.src = url;
  });
  if (k === 'audio') ready = Promise.all([
    new Promise<void>((r) => {
      const au = new Audio(); au.preload = 'metadata';
      au.onloadedmetadata = () => { a.dur = isFinite(au.duration) ? au.duration : 0; r(); };
      au.onerror = () => r(); au.src = url; setTimeout(r, 4000);
    }),
    peaksOf(f).then((pk) => { if (pk) a.peaks = pk; }),
  ]);
  if (k === 'video') ready = new Promise<void>((r) => {
    const v = document.createElement('video'); v.preload = 'auto'; v.muted = true; v.playsInline = true;
    let done = false; const fin = () => { if (!done) { done = true; r(); } };
    v.onloadedmetadata = () => { a.dur = isFinite(v.duration) ? v.duration : 0; try { v.currentTime = Math.min(0.5, a.dur / 2 || 0); } catch { fin(); } };
    v.onseeked = () => {
      try {
        const c = document.createElement('canvas'); c.width = 640; c.height = Math.round(640 * (v.videoHeight / v.videoWidth || 9 / 16));
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height); a.poster = c.toDataURL('image/jpeg', 0.8);
      } catch { /* cross-origin or codec */ }
      fin();
    };
    v.onerror = fin; v.src = url; setTimeout(fin, 5000);
  });
  if (k === 'doc' && docKind(a) !== 'file') ready = readDoc(a);
  return { id: seq++, a, ready };
}

const within = <T,>(p: Promise<T>, ms = 12000) =>
  Promise.race([p, new Promise<never>((_, j) => setTimeout(() => j(new Error('timeout')), ms))]);

export async function readDoc(a: Att) {
  const e = extOf(a.name), base = a.name.replace(/\.\w+$/, '');
  const titled = (ps: string[]) => (ps[0] && ps[0].length < 90 ? ps.shift()! : base);
  const file = a.file!;
  try {
    if (e === 'PDF') { await readPdf(a); if (a.thumb) return; }
    else if (e === 'TXT' || e === 'MD') {
      const t = await file.text(); const ps = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      a.pv = { kind: 'page', title: titled(ps), paras: ps.slice(0, 40), pages: Math.max(1, Math.ceil(t.split(/\s+/).length / 450)) }; return;
    } else if (e === 'CSV') {
      const t = await file.text();
      a.pv = { kind: 'sheet', sheet: base, sheets: 1, rows: t.split(/\r?\n/).filter(Boolean).slice(0, 80).map((l) => l.split(',')) }; return;
    } else if (e === 'XLSX' || e === 'XLS' || e === 'ODS') {
      const X = await within(import('xlsx'));
      const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }); const nm = wb.SheetNames[0];
      a.pv = { kind: 'sheet', sheet: nm, sheets: wb.SheetNames.length, rows: (X.utils.sheet_to_json(wb.Sheets[nm], { header: 1, blankrows: false, defval: '' }) as (string | number)[][]).slice(0, 80) }; return;
    } else if (e === 'DOCX' || e === 'PPTX') {
      const Z = (await within(import('jszip'))).default;
      const zip = await Z.loadAsync(await file.arrayBuffer());
      const txt = (x: string) => x.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
      const paras = (xml: string, p: RegExp, t: RegExp) => xml.split(p).map((x) => txt((x.match(t) || []).join('')).trim()).filter(Boolean);
      if (e === 'DOCX') {
        const ps = paras(await zip.file('word/document.xml')!.async('string'), /<\/w:p>/, /<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g);
        const words = ps.join(' ').split(/\s+/).length;
        a.pv = { kind: 'page', title: titled(ps), paras: ps.slice(0, 40), pages: Math.max(1, Math.ceil(words / 450)) }; return;
      }
      const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((x, y) => parseInt(x.match(/\d+/)![0]) - parseInt(y.match(/\d+/)![0]));
      const slides: { title: string; paras: string[] }[] = [];
      for (const n of names.slice(0, 15)) {
        const ps = paras(await zip.file(n)!.async('string'), /<\/a:p>/, /<a:t(?:\s[^>]*)?>[^<]*<\/a:t>/g);
        slides.push({ title: ps[0] || '', paras: ps.slice(1, 8) });
      }
      if (slides.length) { a.pv = { kind: 'slides', pages: names.length, title: slides[0].title || base, paras: slides[0].paras, slides }; return; }
    }
  } catch { /* fall through to a plain card */ }
  if (!a.pv) a.pv = { kind: docKind(a) === 'sheet' ? 'page' : (docKind(a) as Preview['kind']), title: base, paras: ['No text preview is available for this file.'], pages: a.pages || 0, none: true };
}

type PdfJs = typeof import('pdfjs-dist');
let pdfjsP: Promise<PdfJs> | null = null;
function pdfjs() {
  if (!pdfjsP) pdfjsP = import('pdfjs-dist').then((L) => { L.GlobalWorkerOptions.workerSrc = pdfWorkerUrl; return L; });
  return pdfjsP;
}

async function readPdf(a: Att) {
  try {
    const L = await within(pdfjs(), 10000);
    const doc = await L.getDocument({ data: new Uint8Array(await a.file!.arrayBuffer()) }).promise;
    a.pages = doc.numPages; a.pageImgs = [];
    for (let n = 1; n <= Math.min(3, doc.numPages); n++) {
      const pg = await doc.getPage(n), vp0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 1200 / vp0.width });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext('2d')!, viewport: vp, canvas: cv } as Parameters<typeof pg.render>[0]).promise;
      a.pageImgs.push(cv.toDataURL('image/jpeg', 0.82));
      if (n === 1) {
        a.thumb = a.pageImgs[0];
        const tc = await pg.getTextContent();
        a.excerpt = tc.items.map((t) => ('str' in t ? t.str : '')).join(' ').replace(/\s+/g, ' ').trim().slice(0, 240);
        a.pv = { kind: 'page', title: a.name.replace(/\.pdf$/i, ''), paras: [a.excerpt], pages: a.pages };
      }
    }
  } catch {
    a.excerpt = a.excerpt || '';
  }
}

/** A minimal one-page PDF built from a preview, so sample PDFs can really be downloaded. */
export function makePdf(p: Preview) {
  const asc = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '').replace(/[\\()]/g, '\\$&');
  const wrap = (s: string, n: number) => { const out: string[] = []; let line = ''; for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out; };
  let st = 'BT /F2 20 Tf 26 TL 56 780 Td (' + asc(p.title || '') + ') Tj T* /F1 11 Tf 16 TL T*';
  (p.paras || []).forEach((x) => { wrap(asc(x), 92).forEach((l) => (st += ' (' + l + ') Tj T*')); st += ' T*'; });
  st += ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>', `<< /Length ${st.length} >>\nstream\n${st}\nendstream`];
  let out = '%PDF-1.4\n'; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

export function dataUrlToBlob(u: string) {
  const [h, d] = u.split(',');
  const bin = atob(d), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: h.slice(5).split(';')[0] });
}
