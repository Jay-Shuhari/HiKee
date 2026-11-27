/* Sample landscape pictures painted locally for the demo conversations. */
import { rng } from './format';

interface Pal { sky: [string, string]; m: string[]; snow?: 1; trees?: 1; lake?: string; night?: 1 }
export const PAL: Record<string, Pal> = {
  alpine: { sky: ['#6fa8e0', '#dcebf7'], m: ['#b3c3d4', '#8497ad', '#4e6d4f', '#2d4a2b'], snow: 1, trees: 1 },
  lake: { sky: ['#4f97d4', '#d3e8f6'], m: ['#a6bccf', '#7590a8', '#3f6150', '#1f3a2a'], snow: 1, lake: '#2d6f8f', trees: 1 },
  dawn: { sky: ['#f0a39b', '#fde5c9'], m: ['#cfa0ad', '#a07894', '#5f4b6d', '#2e2740'], lake: '#7a5b78' },
  autumn: { sky: ['#8cb6d8', '#f2e3c5'], m: ['#b9a891', '#a87c50', '#8c4f28', '#3d2a19'], trees: 1 },
  dusk: { sky: ['#28376a', '#f28c5c'], m: ['#6d4f73', '#4b3c5e', '#2b2441', '#15121f'] },
  night: { sky: ['#0a1026', '#2c3a6c'], m: ['#2d3b60', '#202b49', '#141c34', '#0a0f1f'], night: 1, snow: 1 },
  coast: { sky: ['#74b4e3', '#e8f4fb'], m: ['#a8c5d8', '#7fa5bc'], lake: '#1f6f9a' },
  meadow: { sky: ['#86bde8', '#eef6fb'], m: ['#c1cdda', '#91a7bd', '#6f9a52', '#3f6a2e'], snow: 1 },
};

function hexA(h: string, a: number) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function shade(h: string, f: number) {
  const n = parseInt(h.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function paint(seed: number, w: number, h: number, p: Pal): string {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!, R = rng(seed);
  const hz = h * (p.lake ? 0.6 : 0.74);
  let gr: CanvasGradient = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, p.sky[0]); gr.addColorStop(1, p.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (p.night) { g.fillStyle = '#fff'; for (let i = 0; i < 180; i++) { g.globalAlpha = 0.3 + R() * 0.7; const r = R() * 1.3 + 0.2; g.beginPath(); g.arc(R() * w, R() * hz * 0.85, r, 0, 7); g.fill(); } g.globalAlpha = 1; }
  const sx = w * (0.2 + R() * 0.6), sy = h * (0.14 + R() * 0.14), sr = w * (p.night ? 0.045 : 0.06);
  gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 5); gr.addColorStop(0, 'rgba(255,248,220,.85)'); gr.addColorStop(0.25, 'rgba(255,244,210,.3)'); gr.addColorStop(1, 'rgba(255,244,210,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = p.night ? '#f4f1e6' : '#fffaf0'; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  if (!p.night) { g.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 5; i++) { const cx = R() * w, cy = h * (0.08 + R() * 0.3), cw = w * (0.12 + R() * 0.2); for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + (k - 2) * cw * 0.28, cy + Math.sin(k) * 6, cw * 0.3, cw * 0.11, 0, 0, 7); g.fill(); } } }
  const L = p.m.length;
  for (let i = 0; i < L; i++) {
    const y0 = hz + (p.lake ? 0 : i * h * 0.07) - (L - 1 - i) * h * 0.015, amp = h * (0.36 - i * 0.065) * (p.lake ? 0.9 : 1);
    const fs = [1 + R() * 2, 3 + R() * 3, 7 + R() * 5], ph = fs.map(() => R() * 6), wt = [0.55, 0.3, 0.15];
    const pts: [number, number][] = [];
    for (let x = 0; x <= w + 4; x += 4) { let v = 0; fs.forEach((f, k) => (v += wt[k] * (1 - Math.abs(Math.sin((x / w) * f * Math.PI + ph[k]))))); pts.push([x, y0 - amp * Math.pow(v, 1.7)]); }
    g.beginPath(); g.moveTo(0, h); pts.forEach((q) => g.lineTo(q[0], q[1])); g.lineTo(w, h); g.closePath();
    gr = g.createLinearGradient(0, y0 - amp, 0, y0 + h * 0.1); gr.addColorStop(0, p.m[i]); gr.addColorStop(1, shade(p.m[i], -0.25)); g.fillStyle = gr; g.fill();
    if (p.snow && i < 2) { g.save(); g.clip(); gr = g.createLinearGradient(0, y0 - amp, 0, y0 - amp * 0.45); gr.addColorStop(0, 'rgba(255,255,255,.92)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore(); }
    g.save(); g.strokeStyle = 'rgba(255,255,255,' + (0.18 - i * 0.04) + ')'; g.lineWidth = 1.5; g.beginPath(); pts.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); g.restore();
    if (p.lake && i >= L - 2) break;
  }
  if (p.lake) {
    g.save(); g.translate(0, 2 * hz); g.scale(1, -1); g.globalAlpha = 0.5; g.drawImage(c, 0, 0, w, hz, 0, 0, w, hz); g.restore();
    gr = g.createLinearGradient(0, hz, 0, h); gr.addColorStop(0, hexA(p.lake, 0.35)); gr.addColorStop(1, hexA(p.lake, 0.85)); g.fillStyle = gr; g.fillRect(0, hz, w, h - hz);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const y = hz + R() * (h - hz), x = R() * w, l = 20 + R() * 80; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
  }
  if (p.trees) {
    const col = shade(p.m[L - 1], -0.35); g.fillStyle = col; const n = Math.round(w / 14);
    for (let i = 0; i < n; i++) { const x = R() * w; if (p.lake && x > w * 0.3 && x < w * 0.7) continue; const by = h - R() * h * 0.06, th = h * (0.07 + R() * 0.13), tw = th * 0.32; g.beginPath(); g.moveTo(x, by - th); g.lineTo(x - tw, by); g.lineTo(x + tw, by); g.closePath(); g.fill(); }
    if (p.lake) g.fillRect(0, h - h * 0.03, w, h * 0.03);
  }
  gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.86);
}
