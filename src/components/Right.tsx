import { useRef, type ReactNode } from 'react';
import type { Att, Chat, Msg } from '../data/types';
import { I } from '../lib/icons';
import { isPdf, listTime, mmss } from '../lib/format';
import { confirmBox, logout, openChat, setQuery, setTheme, startChatWith, useApp, visibleMsgs } from '../state/store';
import { Avatar } from './common';

function preview(m: Msg): ReactNode {
  if (m.text) return m.text;
  const imgs = m.atts.filter((a) => a.type === 'image').length, a = m.atts[0];
  if (imgs) return <><I n="image" />{imgs > 1 ? imgs + ' photos' : 'Photo'}</>;
  if (!a) return '';
  return a.type === 'video' ? <><I n="video" />Video</>
    : a.type === 'audio' ? <><I n="audio" />Voice message {mmss(a.dur || 0)}</>
    : <><I n={isPdf(a) ? 'pdf' : 'doc'} />{a.name}</>;
}

function hl(text: string, q: string): ReactNode {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  const s = Math.max(0, i - 18);
  return <span className='hl'>{s ? '…' : ''}{text.slice(s, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</span>;
}
function docAll(a: Att) {
  const pv = a.pv;
  if (!pv) return a.excerpt || '';
  return pv.kind === 'sheet' ? (pv.rows || []).map((r) => r.join(' ')).join(' ')
    : [pv.title, ...(pv.slides ? pv.slides.flatMap((x) => [x.title, ...x.paras]) : pv.paras || [])].join(' ');
}
const docText = (a: Att) => (a.name + ' ' + docAll(a)).toLowerCase();
export const findHit = (c: Chat, q: string) =>
  [...visibleMsgs(c)].reverse().find((m) => m.text.toLowerCase().includes(q) || m.atts.some((a) => a.type === 'doc' && docText(a).includes(q)));

/** Live state of the realtime WebSocket (hidden in demo mode). */
function ConnBadge() {
  const conn = useApp((s) => s.conn);
  if (conn === 'local') return null;
  const label = conn === 'live' ? 'Live' : conn === 'connecting' ? 'Connecting…' : 'Offline — waiting for network';
  return <span className={'conn ' + conn} title={conn === 'live' ? 'Connected over WebSocket — updates arrive instantly' : label}><i />{label}</span>;
}

export function Right() {
  const chats = useApp((s) => s.chats);
  const active = useApp((s) => s.active);
  const q0 = useApp((s) => s.q);
  const muted = useApp((s) => s.muted);
  const people = useApp((s) => s.people);
  const mode = useApp((s) => s.backend?.mode);
  const theme = useApp((s) => s.theme);
  const resolvedDark = document.documentElement.dataset.theme === 'dark';
  const inp = useRef<HTMLInputElement>(null);
  const q = q0.trim().toLowerCase();

  let rows = chats;
  const hits: Record<string, Msg | undefined> = {};
  if (q) rows = rows.filter((c) => { const nm = c.name.toLowerCase().includes(q); const mm = findHit(c, q); if (mm) hits[c.id] = mm; return nm || !!mm; });

  return (
    <aside className="right" aria-label="Chats">
      <div className="rhead">
        <img className="logo mlogo" src="/logo.png" alt="" /><h2>Chats</h2><span>{chats.length}</span>
        <button className="ib" aria-label={`Switch to ${resolvedDark ? 'light' : 'dark'} theme`} title={`Theme: ${theme}`}
          onClick={() => setTheme(resolvedDark ? 'light' : 'dark')}><I n={resolvedDark ? 'sun' : 'moon'} /></button>
      </div>
      <label className={`search ${q0 ? 'has' : ''}`}>
        <I n="search" />
        <input ref={inp} id="q" type="search" placeholder={mode === 'aws' ? 'Search chats, messages or people' : 'Search chats and messages'}
          aria-label="Search chats and messages" value={q0} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="clr" aria-label="Clear search" onClick={(e) => { e.preventDefault(); setQuery(''); inp.current?.focus(); }}><I n="x" /></button>
      </label>
      <div className="lh"><span>{q ? 'Results' : 'All chats'}</span><span>{q ? rows.length + (rows.length === 1 ? ' chat' : ' chats') : <ConnBadge />}</span></div>
      <div className="list" role="listbox" aria-label="Conversations">
        {rows.map((c, i) => {
          const last = visibleMsgs(c).at(-1), h = hits[c.id];
          let pv: ReactNode = last ? <>{last.from === 'me' ? 'You: ' : ''}{preview(last)}</> : 'No messages';
          if (h && !c.name.toLowerCase().includes(q)) {
            if (h.text.toLowerCase().includes(q)) pv = hl(h.text, q);
            else { const d = h.atts.find((a) => a.type === 'doc' && docText(a).includes(q))!; const src = d.name.toLowerCase().includes(q) ? d.name : docAll(d); pv = <><I n="pdf" />{hl(src, q)}</>; }
          }
          return (
            <button key={c.id} className={`ci ${c.id === active ? 'act' : ''} ${c.unread ? 'unr' : ''}`} role="option" aria-selected={c.id === active}
              style={{ animationDelay: i * 35 + 'ms' }} onClick={() => openChat(c.id, q ? findHit(c, q)?.id : undefined)}>
              <Avatar c={c} sz={46} />
              <span className="ct">
                <span className="r1"><b>{c.name}</b><time>{last ? listTime(last.t) : ''}</time></span>
                <span className="r2"><span className="pv">{pv}</span>
                  {muted.includes(c.id) ? <span className="mute"><I n="bellOff" /></span> : null}
                  {c.unread ? <span className="badge">{c.unread}</span> : null}</span>
              </span>
            </button>
          );
        })}
        {people.length ? <div className="lh" style={{ padding: '14px 14px 4px' }}><span>People</span><span>Start a new chat</span></div> : null}
        {people.map((p) => (
          <button key={p.id} className="ci new" onClick={() => startChatWith(p)}>
            <Avatar c={p} sz={46} dot={false} />
            <span className="ct"><span className="r1"><b>{p.name}</b></span><span className="r2"><span className="pv"><I n="plus" />{p.email}</span></span></span>
          </button>
        ))}
        {!rows.length && !people.length ? (
          q ? <div className="nores">No chats or messages match “{q0}”.{mode === 'aws' && q.length >= 2 ? ' Try someone’s full email address to start a new chat.' : ''}</div>
            : <div className="nores">No chats yet.{mode === 'aws' ? ' Search for someone by name or email to start one.' : ''}</div>
        ) : null}
      </div>
      <div className="rfoot">
        <button className="logout" onClick={() => confirmBox('Log out of HiKee?', 'You can log back in any time.', 'Log out', 'red', logout)}><I n="logout" />Log out</button>
      </div>
    </aside>
  );
}
