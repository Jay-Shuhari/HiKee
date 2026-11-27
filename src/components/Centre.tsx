import { useEffect, useRef, useState } from 'react';
import type { Chat, ThemePref } from '../data/types';
import { I, type IconName } from '../lib/icons';
import { firstName, listTime, mmss, status } from '../lib/format';
import { clearChat, isMob, openViewer, setPage, setTheme, setView, toggleMute, useApp } from '../state/store';
import { acceptCall, declineCall, hangUp, startCall, toggleCam, toggleMic } from '../state/call';
import { Avatar, Img, replay, thumbOf } from './common';
import { NAV, mediaItems } from './Left';
import { DocCard, VoiceNote } from './parts';
import { Conversation } from './Conversation';

const THEMES: [ThemePref, string, IconName][] = [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'Auto', 'monitor']];

function Header({ c }: { c: Chat }) {
  const muted = useApp((s) => s.muted.includes(c.id));
  const theme = useApp((s) => s.theme);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (!(e.target as Element).closest('.acts')) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', f); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('click', f); document.removeEventListener('keydown', k); };
  }, [open]);
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <header className="chead">
      <button className="ib mob" aria-label="Back to chats" onClick={() => setPage('home')}><I n="back" /></button>
      <div className="who">
        <Avatar c={c} sz={44} />
        <div style={{ minWidth: 0 }}>
          <div className="nm">{c.name}</div>
          <div className={`st ${c.online ? 'live' : ''}`}>{status(c)}{muted ? ' · Muted' : ''}</div>
        </div>
      </div>
      <div className="acts">
        <button className="ib mob" aria-label="Shared media" onClick={() => setPage('media')}><I n="media" /></button>
        <button className="ib" aria-label="Voice call" title="Voice call" onClick={() => startCall('voice')}><I n="phone" /></button>
        <button className="ib" aria-label="Video call" title="Video call" onClick={() => startCall('video')}><I n="cam" /></button>
        <button className="ib" aria-label="More options" aria-haspopup="true" aria-expanded={open} title="More" onClick={() => setOpen(!open)}><I n="more" /></button>
        <div className={`pop menu ${open ? 'open' : ''}`} role="menu">
          <button className="mi" role="menuitem" onClick={run(() => setView('media'))}><I n="media" />Shared media</button>
          <button className="mi" role="menuitem" onClick={run(() => toggleMute(c.id))}><I n={muted ? 'bell' : 'bellOff'} />{muted ? 'Unmute notifications' : 'Mute notifications'}</button>
          <div className="msep" />
          <div className="mlabel">Theme</div>
          <div className="seg" role="radiogroup" aria-label="Theme">
            {THEMES.map(([k, l, ic]) => (
              <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? 'on' : ''} onClick={() => setTheme(k)}><I n={ic} />{l}</button>
            ))}
          </div>
          <div className="msep" />
          <button className="mi danger" role="menuitem" onClick={run(() => clearChat(c.id))}><I n="trash" />Clear chat</button>
        </div>
      </div>
    </header>
  );
}

function MediaView({ c }: { c: Chat }) {
  const view = useApp((s) => s.view)!;
  const swapN = useApp((s) => s.swapN);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { replay(ref.current, 'swap'); }, [swapN]);
  const nav = NAV.find((n) => n[0] === view)!, items = mediaItems(c, view), first = firstName(c.name);
  const back = () => { setView(null); if (isMob()) setPage('media'); };
  let body;
  if (!items.length) body = (
    <div className="empty"><I n={nav[2]} /><b>No {nav[1].toLowerCase()} yet</b><span>{nav[1]} you and {first} share will appear here.</span>
      <button className="btn ghost" onClick={back}>Back to chat</button></div>
  );
  else if (view === 'documents') body = <div className="dgrid">{items.map((it, i) => <div key={it.key} style={{ animationDelay: Math.min(i, 12) * 40 + 'ms' }}><DocCard a={it.a} /></div>)}</div>;
  else if (view === 'audio') body = (
    <div className="mlist">{items.map((it, i) => (
      <div key={it.key} className="mrow" style={{ animationDelay: Math.min(i, 12) * 40 + 'ms' }}>
        <VoiceNote a={it.a} k={it.key} /><time>{it.m.from === 'me' ? 'You' : first} · {listTime(it.m.t)}</time>
      </div>))}
    </div>
  );
  else body = (
    <div className="mgrid">{items.map((it, i) => {
      const [src, key] = thumbOf(it.a);
      return (
        <button key={it.key} className="mtile" style={{ animationDelay: Math.min(i, 16) * 30 + 'ms' }} aria-label={'Open ' + (it.a.name || 'item')}
          onClick={() => openViewer(items.map((x) => x.a), i)}>
          <Img src={src} k={key} />
          {it.a.type === 'video' ? <><span className="play"><I n="play" /></span><span className="dur">{mmss(it.a.dur || 0)}</span></> : null}
        </button>
      );
    })}</div>
  );
  return (
    <section className="pane" ref={ref}>
      <div className="mbar"><button className="back" onClick={back}><I n="back" />{isMob() ? 'Media' : 'Chat'}</button><h2>{nav[1]}</h2><small>{items.length} shared with {first}</small></div>
      <div className="mbody">{body}</div>
    </section>
  );
}

function Video({ stream, cls, muted }: { stream?: MediaStream | null; cls: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  return <video ref={ref} className={cls} autoPlay playsInline muted={muted} />;
}

function CallOverlay() {
  const call = useApp((s) => s.call);
  const chat = useApp((s) => s.chats.find((c) => c.id === s.call?.chatId));
  const [, tick] = useState(0);
  const last = useRef(call);
  if (call) last.current = call;
  const c = call || last.current;
  useEffect(() => {
    if (call?.phase !== 'connected') return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [call?.phase]);
  const endRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (call) endRef.current?.focus(); }, [!!call]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c || !chat) return <div className="call" role="dialog" aria-modal="true" aria-label="Call" />;
  const video = c.kind === 'video' && !c.demo;
  const secs = c.startedAt ? (Date.now() - c.startedAt) / 1000 : 0;
  const text = c.phase === 'connected' ? (c.status || mmss(secs)) : c.status;
  return (
    <div className={`call ${call ? 'open' : ''} ${c.phase !== 'connected' ? 'ringing' : 'connected'} ${video ? 'video' : ''}`} role="dialog" aria-modal="true" aria-label="Call">
      {video ? <Video stream={c.remote} cls="rv" /> : null}
      {video && c.local ? <Video stream={c.local} cls="lv" muted /> : null}
      {!video && c.remote ? <Video stream={c.remote} cls="rv" /> : null}
      <div className="cinfo">
        <div className="rings"><Avatar c={chat} sz={96} dot={false} /></div>
        <h3>{chat.name}</h3>
        <p>{text}</p>
        <div className="cbtns">
          {c.phase === 'incoming' ? (
            <>
              <button className="cbtn end" ref={endRef} aria-label="Decline" onClick={declineCall}><I n="phone" /></button>
              <button className="cbtn ok" aria-label="Accept" onClick={acceptCall}><I n={c.kind === 'video' ? 'cam' : 'phone'} /></button>
            </>
          ) : (
            <>
              {!c.demo ? <button className={`cbtn ${c.mic ? '' : 'off'}`} aria-label={c.mic ? 'Mute microphone' : 'Unmute microphone'} onClick={toggleMic}><I n={c.mic ? 'mic' : 'micOff'} /></button> : null}
              <button className="cbtn end" ref={endRef} aria-label="End call" onClick={() => hangUp()}><I n="phone" /></button>
              {!c.demo && c.kind === 'video' ? <button className={`cbtn ${c.cam ? '' : 'off'}`} aria-label={c.cam ? 'Turn camera off' : 'Turn camera on'} onClick={toggleCam}><I n={c.cam ? 'cam' : 'camOff'} /></button> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Centre({ c }: { c: Chat | null }) {
  const view = useApp((s) => s.view);
  return (
    <main className="centre">
      {c ? <Header c={c} /> : null}
      {c ? (view ? <MediaView c={c} /> : <Conversation c={c} />) : (
        <section className="pane"><div className="empty" style={{ margin: 'auto' }}><I n="chats" /><b>No conversation selected</b>
          <span>Search for someone by name or email in the Chats panel to start talking.</span></div></section>
      )}
      <CallOverlay />
    </main>
  );
}

