import { useEffect, useRef, useState } from 'react';
import type { Chat } from '../data/types';
import { I, type IconName } from '../lib/icons';
import { mmss, size } from '../lib/format';
import { peaksOf, type Pending } from '../lib/files';
import { postAtt, send, toast } from '../state/store';
import { ExtBadge, replay } from './common';

const ATT: [string, string, string, IconName, string][] = [
  ['image/*', 'Pictures', 'JPG, PNG, GIF', 'image', '#7c5cff'],
  ['video/*', 'Videos', 'MP4, MOV, WEBM', 'video', '#e5487a'],
  ['.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.zip,application/*', 'Documents', 'PDF, DOCX, XLSX', 'doc', '#2f6fed'],
  ['audio/*', 'Audio', 'MP3, M4A, WAV', 'audio', '#e8860c'],
];
const EMO = '😀 😂 😊 😍 🥰 😎 🤔 😅 😉 🙌 👍 👏 🙏 💪 🔥 ✨ 🎉 ❤️ 💙 😢 😮 😴 🤝 👀 ☀️ 🌙 ⛰️ 🏔️ 🌲 🌊 📷 🎬 🎧 📄 ✅ ☕ 🍕 ✈️ 🚗 🌅'.split(' ');
const SPARK = ['#3d50e0', '#7c5cff', '#e5487a', '#e8860c', '#1f9d55'];

function burst(btn: HTMLElement) {
  const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const rp = document.createElement('span'); rp.className = 'rp'; btn.appendChild(rp); setTimeout(() => rp.remove(), 650);
  if (!document.body.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 10; i++) {
    const d = document.createElement('i'); d.className = 'spark';
    d.style.left = cx - 3 + 'px'; d.style.top = cy - 3 + 'px'; d.style.background = SPARK[i % 5];
    document.body.appendChild(d);
    const ang = -Math.PI * 0.15 - Math.random() * Math.PI * 1.1, dist = 26 + Math.random() * 30;
    d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) scale(.2)`, opacity: 0 }], { duration: 520 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => d.remove();
  }
}

interface Props { chat: Chat; pending: Pending[]; setPending: React.Dispatch<React.SetStateAction<Pending[]>>; addFiles: (f: FileList | File[]) => void }

export function Composer({ chat, pending, setPending, addFiles }: Props) {
  const [text, setText] = useState('');
  const [pop, setPop] = useState<'attach' | 'emoji' | null>(null);
  const [rec, setRec] = useState(false);
  const [leaving, setLeaving] = useState<number | null>(null);
  const txt = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const recSendRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const R = useRef<{ rec: MediaRecorder | null; stream: MediaStream | null; chunks: Blob[]; t0: number; raf: number; ctx: AudioContext | null; cancel: boolean }>({ rec: null, stream: null, chunks: [], t0: 0, raf: 0, ctx: null, cancel: false });
  const sending = useRef(false);

  const fit = () => { const t = txt.current; if (!t) return; t.style.height = '42px'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; };
  useEffect(fit, [text]);
  /* switching chats resets the draft and any recording */
  useEffect(() => { setText(''); setPop(null); stopRec(true); }, [chat.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* close popovers on outside click; Escape closes popovers / discards recording */
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!(e.target as Element).closest('.pw')) setPop(null); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (R.current.rec) { stopRec(true); toast('Voice note discarded'); } else if (pop) setPop(null);
    };
    document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const canSend = !!text.trim() || pending.length > 0;

  async function doSend() {
    const t = text.trim();
    if ((!t && !pending.length) || sending.current) return;
    sending.current = true;
    const b = sendRef.current!; replay(b, 'fly'); burst(b);
    const from = boxRef.current!.getBoundingClientRect();
    const pend = pending;
    setText(''); setPending([]); replay(txt.current, 'clear');
    try { await send(t, pend, from); } finally { sending.current = false; txt.current?.focus(); }
  }

  function removeChip(id: number) {
    setLeaving(id);
    setTimeout(() => { setPending((p) => p.filter((x) => x.id !== id)); setLeaving(null); }, 180);
  }

  function insertEmoji(e: string) {
    const t = txt.current!, s = t.selectionStart ?? text.length, en = t.selectionEnd ?? s;
    const v = text.slice(0, s) + e + text.slice(en);
    setText(v);
    requestAnimationFrame(() => { t.focus(); t.setSelectionRange(s + e.length, s + e.length); });
  }

  /* ---------- voice note recording ---------- */
  async function startRec() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Voice notes need a browser with microphone recording.'); return; }
    const r = R.current;
    try { r.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast('Microphone access was blocked. Allow the microphone for this page to record voice notes.'); return; }
    r.chunks = []; r.cancel = false; r.rec = new MediaRecorder(r.stream);
    r.rec.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data); };
    r.rec.onstop = () => {
      const dur = (performance.now() - r.t0) / 1000;
      r.stream?.getTracks().forEach((t) => t.stop()); cancelAnimationFrame(r.raf); r.ctx?.close?.().catch(() => {});
      setRec(false);
      if (!r.cancel && r.chunks.length && dur > 0.6) {
        const type = r.rec?.mimeType || 'audio/webm';
        const blob = new Blob(r.chunks, { type }), from = boxRef.current?.getBoundingClientRect();
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        peaksOf(blob).then((pk) => postAtt({ type: 'audio', src: URL.createObjectURL(blob), dur, name: `Voice message.${ext}`, size: blob.size, file: blob, mime: type, peaks: pk || undefined }, from));
      }
      r.rec = null;
    };
    r.rec.start(); r.t0 = performance.now(); setRec(true);
    let an: AnalyserNode | null = null;
    try { r.ctx = new AudioContext(); const src = r.ctx.createMediaStreamSource(r.stream); an = r.ctx.createAnalyser(); an.fftSize = 256; src.connect(an); } catch { an = null; }
    const buf = new Uint8Array(256); let lastPush = 0;
    const loop = (ts: number) => {
      if (timeRef.current) timeRef.current.textContent = mmss((performance.now() - r.t0) / 1000);
      const bars = waveRef.current ? [...waveRef.current.children] as HTMLElement[] : [];
      if (ts - lastPush > 90 && bars.length) {
        lastPush = ts;
        let v = 0.15 + Math.random() * 0.2;
        if (an) { an.getByteTimeDomainData(buf); let mx = 0; for (const x of buf) mx = Math.max(mx, Math.abs(x - 128)); v = Math.min(1, 0.08 + mx / 60); }
        for (let i = 0; i < bars.length - 1; i++) bars[i].style.height = bars[i + 1].style.height || '10%';
        bars[bars.length - 1].style.height = Math.round(v * 100) + '%';
      }
      r.raf = requestAnimationFrame(loop);
    };
    r.raf = requestAnimationFrame(loop);
  }
  function stopRec(cancel: boolean) { const r = R.current; if (!r.rec) return; r.cancel = cancel; r.rec.stop(); }

  return (
    <form className="composer" autoComplete="off" onSubmit={(e) => { e.preventDefault(); doSend(); }}>
      <div className={`box ${rec ? 'rec' : ''}`} ref={boxRef}>
        <div className="pending">
          {pending.map((p) => {
            const a = p.a;
            return a.type === 'image' ? (
              <div key={p.id} className={`chip img ${leaving === p.id ? 'out' : ''}`}><img src={a.src} alt="" />
                <button type="button" className="rm" aria-label={`Remove ${a.name}`} onClick={() => removeChip(p.id)}><I n="x" /></button></div>
            ) : (
              <div key={p.id} className={`chip ${leaving === p.id ? 'out' : ''}`}>
                {a.type === 'doc' ? <ExtBadge name={a.name} /> : <I n={a.type === 'video' ? 'video' : 'audio'} />}
                <span className="cn">{a.name}<small>{size(a.size)}</small></span>
                <button type="button" className="rm" aria-label={`Remove ${a.name}`} onClick={() => removeChip(p.id)}><I n="x" /></button>
              </div>
            );
          })}
        </div>
        <div className="crow">
          <div className="pw">
            <button type="button" className={`ib ${pop === 'attach' ? 'open' : ''}`} id="attachBtn" aria-label="Attach a file" aria-haspopup="true" aria-expanded={pop === 'attach'}
              onClick={() => setPop(pop === 'attach' ? null : 'attach')}><I n="clip" /></button>
            <div className={`pop attach ${pop === 'attach' ? 'open' : ''}`} role="menu">
              <div className="att-h">Share in chat<small>Up to 100 MB</small></div>
              <div className="att-g">
                {ATT.map(([acc, l, h, ic, col], i) => (
                  <button key={l} type="button" className="tile" role="menuitem" style={{ ['--d' as string]: 60 + i * 55 + 'ms' }}
                    onClick={() => { setPop(null); const f = fileRef.current!; f.accept = acc; f.click(); }}>
                    <span className="tic" style={{ background: col }}><I n={ic} /></span><b>{l}</b><small>{h}</small>
                  </button>
                ))}
              </div>
              <div className="att-f"><I n="upload" />or drag files into the conversation</div>
            </div>
          </div>
          <textarea ref={txt} rows={1} placeholder="Write a message…" aria-label="Message" value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); doSend(); } }}
            onPaste={(e) => { const fs = [...e.clipboardData.files]; if (fs.length) { e.preventDefault(); addFiles(fs); } }} />
          <div className="pw">
            <button type="button" className="ib" aria-label="Insert emoji" aria-haspopup="true" aria-expanded={pop === 'emoji'} onClick={() => setPop(pop === 'emoji' ? null : 'emoji')}><I n="smile" /></button>
            <div className={`pop emoji ${pop === 'emoji' ? 'open' : ''}`} role="menu">
              {EMO.map((e) => <button key={e} type="button" aria-label={e} onClick={() => insertEmoji(e)}>{e}</button>)}
            </div>
          </div>
          <button type="button" className="ib" id="micBtn" aria-label="Record a voice note" title="Record a voice note" onClick={startRec}><I n="mic" /></button>
          <button type="submit" className="sendb" ref={sendRef} aria-label="Send message" disabled={!canSend}><I n="send" /></button>
        </div>
        <div className="recbar" aria-live="polite">
          <button type="button" className="ib" aria-label="Discard recording" onClick={() => { stopRec(true); toast('Voice note discarded'); }}><I n="trash" /></button>
          <span className="rdot" /><span className="rt" ref={timeRef}>0:00</span>
          <div className="rwave" ref={waveRef}>{Array.from({ length: 46 }, (_, i) => <i key={i} />)}</div>
          <button type="button" className="sendb" ref={recSendRef} aria-label="Send voice note" onClick={() => { burst(recSendRef.current!); stopRec(false); }}><I n="send" /></button>
        </div>
      </div>
      <input type="file" ref={fileRef} multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; requestAnimationFrame(() => txt.current?.focus()); }} />
    </form>
  );
}
