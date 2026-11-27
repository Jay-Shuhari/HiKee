/* Full-screen viewer for images, videos and document previews, with swipe/scroll snap,
   thumbnails, keyboard navigation, download and full-screen toggle. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Att, Cell } from '../data/types';
import { I } from '../lib/icons';
import { extColor, mmss } from '../lib/format';
import { closeViewer, useApp } from '../state/store';
import { canDownload, download, Img, thumbOf, useUrl } from './common';

function cells(r: Cell[], head: boolean) {
  return r.slice(0, 30).map((v, i) => (head ? <th key={i}>{String(v)}</th> : <td key={i} className={typeof v === 'number' ? 'n' : undefined}>{String(v)}</td>));
}

/** Sample videos have no file: a canvas pans over the poster to stand in for playback. */
function SampleVideo({ a, active }: { a: Att; active: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const st = useRef({ t: 0, last: 0, raf: 0 });
  const img = useRef<HTMLImageElement | null>(null);
  const dur = a.dur || 1;
  const draw = (p: number) => {
    const c = cv.current, im = img.current; if (!c || !im?.complete) return;
    const g = c.getContext('2d')!, s = 1.08 + 0.12 * p, w = c.width * s, h = c.height * s;
    g.drawImage(im, -(w - c.width) * p, -(h - c.height) * (0.5 + 0.3 * Math.sin(p * 3)), w, h);
  };
  useEffect(() => { const im = new Image(); im.onload = () => draw(st.current.t / dur); im.src = a.poster || ''; img.current = im; }, [a.poster]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  useEffect(() => {
    if (!playing) return;
    st.current.last = performance.now();
    const step = (ts: number) => {
      const s = st.current; s.t += (ts - s.last) / 1000; s.last = ts;
      if (s.t >= dur) { s.t = 0; setT(0); draw(0); setPlaying(false); return; }
      setT(s.t); draw(s.t / dur); s.raf = requestAnimationFrame(step);
    };
    st.current.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(st.current.raf);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="vp">
      <canvas ref={cv} width={960} height={540} />
      <div className="vc">
        <button className="gb" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}><I n={playing ? 'pause' : 'play'} /></button>
        <div className="pb" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); st.current.t = ((e.clientX - r.left) / r.width) * dur; setT(st.current.t); draw(st.current.t / dur); if (!playing) setPlaying(true); }}>
          <i style={{ width: (t / dur) * 100 + '%' }} />
        </div>
        <span className="vt">{mmss(t)} / {mmss(dur)}</span>
      </div>
    </div>
  );
}

function RealVideo({ a, active }: { a: Att; active: boolean }) {
  const src = useUrl(a.src, a.key), poster = useUrl(a.poster, a.posterKey);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (!active) ref.current?.pause(); }, [active]);
  if (!src) return <div className="spin" />;
  return <video ref={ref} src={src} controls playsInline preload="metadata" poster={poster} />;
}

function Slide({ a, active }: { a: Att; active: boolean }) {
  if (a.type === 'image') return <Img src={a.src} k={a.key} alt={a.name || 'Image'} />;
  if (a.type === 'video') return a.src || a.key ? <RealVideo a={a} active={active} /> : <SampleVideo a={a} active={active} />;
  if (a.type === 'doc') {
    const pv = a.pv;
    if (a.pageImgs?.length) return <div className="pdfv">{a.pageImgs.map((s, i) => <img key={i} src={s} alt="" />)}</div>;
    if (a.pageKeys?.length) return <div className="pdfv">{a.pageKeys.map((k) => <Img key={k} k={k} />)}</div>;
    if (!pv) return <div className="pdfv"><div className="bigpage"><h1>{a.name}</h1><p>Preparing preview…</p></div></div>;
    if (pv.kind === 'sheet') return (
      <div className="pdfv"><div className="bigsheet"><span className="stab">{pv.sheet || 'Sheet 1'}</span>
        <table><tbody>{(pv.rows || []).map((r, i) => <tr key={i}>{cells(r, i === 0)}</tr>)}</tbody></table></div></div>
    );
    if (pv.kind === 'slides') return (
      <div className="pdfv">{(pv.slides || [{ title: pv.title || '', paras: pv.paras || [] }]).map((x, i) => (
        <div key={i} className="bigslide"><h2>{x.title}</h2>{x.paras.map((p, j) => <p key={j}>{p}</p>)}</div>))}</div>
    );
    return (
      <div className="pdfv"><div className="bigpage"><h1>{pv.title}</h1><div className="rule" style={{ background: extColor(a.name) }} />
        {(pv.paras || []).map((p, i) => <p key={i}>{p}</p>)}</div></div>
    );
  }
  return null;
}

export function Viewer() {
  const v = useApp((s) => s.viewer);
  const last = useRef(v);
  if (v) last.current = v;
  const items = (v || last.current)?.items || [];
  const [i, setI] = useState(0);
  const [fs, setFs] = useState(!!document.fullscreenElement);
  const track = useRef<HTMLDivElement>(null);
  const gal = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const open = !!v;

  useLayoutEffect(() => {
    if (!v) return;
    lastFocus.current = document.activeElement;
    setI(v.i);
    requestAnimationFrame(() => { if (track.current) track.current.scrollLeft = v.i * track.current.clientWidth; closeBtn.current?.focus(); });
    try { if (!document.fullscreenElement && gal.current?.requestFullscreen) gal.current.requestFullscreen().catch(() => {}); } catch { /* ignore */ }
  }, [v]);

  const close = () => {
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch { /* ignore */ }
    closeViewer();
    (lastFocus.current as HTMLElement | null)?.focus?.();
  };
  const go = (n: number) => { const k = Math.max(0, Math.min(items.length - 1, n)); track.current?.scrollTo({ left: k * track.current.clientWidth, behavior: 'smooth' }); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  useEffect(() => {
    const f = () => { setFs(!!document.fullscreenElement); requestAnimationFrame(() => { if (track.current) track.current.scrollLeft = i * track.current.clientWidth; }); };
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, [i]);
  useEffect(() => {
    if (!track.current) return;
    const ro = new ResizeObserver(() => { if (open && track.current) track.current.scrollLeft = i * track.current.clientWidth; });
    ro.observe(track.current);
    return () => ro.disconnect();
  }, [open, i]);
  useEffect(() => { document.querySelector('.thumbs button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [i]);

  const a = items[i];
  return (
    <div className={`gal ${open ? 'open' : ''}`} ref={gal} role="dialog" aria-modal="true" aria-label="Viewer" aria-hidden={!open}>
      <div className="gtop">
        <div className="gc"><b>{i + 1} / {items.length}</b>{a?.name || ''}</div>
        {canDownload(a) ? <button className="gb dlb" aria-label="Download" onClick={() => download(a)}><I n="down" /><span>Download</span></button> : null}
        <button className="gb" aria-label="Toggle full screen" title="Full screen"
          onClick={() => { try { if (document.fullscreenElement) document.exitFullscreen(); else gal.current?.requestFullscreen(); } catch { /* ignore */ } }}>
          <I n={fs ? 'shrink' : 'expand'} />
        </button>
        <button className="gb" ref={closeBtn} aria-label="Close viewer" onClick={close}><I n="x" /></button>
      </div>
      <div className="gstage">
        <div className="track" ref={track} onScroll={(e) => { const el = e.currentTarget, k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (k !== i) setI(k); }}>
          {open || last.current ? items.map((x, k) => <div key={k} className="slide"><Slide a={x} active={open && k === i} /></div>) : null}
        </div>
        {items.length > 1 ? <>
          <button className="gb gnav p" aria-label="Previous" disabled={i <= 0} onClick={() => go(i - 1)}><I n="chevL" /></button>
          <button className="gb gnav n" aria-label="Next" disabled={i >= items.length - 1} onClick={() => go(i + 1)}><I n="chevR" /></button>
        </> : null}
      </div>
      <div className="thumbs">
        {items.length > 1 ? items.map((x, k) => {
          const [src, key] = thumbOf(x);
          return <button key={k} className={k === i ? 'on' : ''} aria-label={`Show item ${k + 1}`} onClick={() => go(k)}><Img src={src} k={key} /></button>;
        }) : null}
      </div>
    </div>
  );
}
