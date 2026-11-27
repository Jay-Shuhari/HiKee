import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Chat, Msg } from '../data/types';
import { I } from '../lib/icons';
import { dayLabel, firstName, hm, prefersReducedMotion, sameDay } from '../lib/format';
import { prep, type Pending } from '../lib/files';
import { effStatus, loadOlder, retry, useApp, visibleMsgs } from '../state/store';
import { Avatar, replay } from './common';
import { MsgBody } from './parts';
import { Composer } from './Composer';

function Ticks({ c, m }: { c: Chat; m: Msg }) {
  const st = effStatus(c, m);
  if (st === 'failed') return (
    <span className="fail"><I n="alert" />Not sent <button onClick={() => retry(c.id, m.id)}>Retry</button></span>
  );
  return (
    <span aria-label={st}>
      {st === 'sending' ? <I n="clock" /> : st === 'sent' ? <I n="check" /> : st === 'delivered' ? <I n="checks" /> : <I n="checks" c="read" />}
    </span>
  );
}

function MessageRow({ c, m, prev, next, isNew }: { c: Chat; m: Msg; prev?: Msg; next?: Msg; isNew: boolean }) {
  const me = m.from === 'me';
  const cont = !!prev && prev.from === m.from && m.t - prev.t < 5 * 60000 && sameDay(prev.t, m.t);
  const last = !(next && next.from === m.from && next.t - m.t < 5 * 60000 && sameDay(next.t, m.t));
  const showMeta = last || m.status === 'failed' || m.status === 'sending';
  return (
    <div className={`msg ${me ? 'me' : 'them'} ${cont ? 'cont' : ''} ${!last ? 'hid' : ''} ${isNew ? 'enter' : ''} ${m.status === 'sending' ? 'sending' : ''}`} id={'m-' + m.id}>
      {me ? null : <Avatar c={c} sz={30} dot={false} cls="sm" />}
      <div className="stk">
        <MsgBody m={m} />
        {m.text ? <div className="bub">{m.text}</div> : null}
        {m.progress !== undefined && m.status === 'sending' ? <div className="upl">Uploading… {Math.round(m.progress * 100)}%</div> : null}
        {showMeta ? <div className="meta">{hm(m.t)}{me ? <Ticks c={c} m={m} /> : null}</div> : null}
      </div>
    </div>
  );
}

export function Conversation({ c }: { c: Chat }) {
  const swapN = useApp((s) => s.swapN);
  const flash = useApp((s) => s.flash);
  const fly = useApp((s) => s.fly);
  const ref = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const known = useRef<{ chat: string; ids: Set<string>; max: number }>({ chat: '', ids: new Set(), max: 0 });
  /** Scroll position saved before older messages are prepended, so the view doesn't jump. */
  const anchor = useRef<{ h: number; top: number } | null>(null);
  const olderLoading = useApp((s) => s.olderLoading === c.id);
  const msgs = visibleMsgs(c);

  /* pending attachments live here so drag-and-drop on the whole pane can add to them */
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(0);
  const addFiles = (files: FileList | File[]) => {
    const added = [...files].map(prep); // read the FileList now: the input is reset right after
    setPending((p) => [...p, ...added]);
  };
  useEffect(() => { setPending([]); }, [c.id]);

  /* which messages are new since the last render of this chat */
  const fresh = new Set<string>();
  if (known.current.chat === c.id) for (const m of msgs) if (!known.current.ids.has(m.id) && m.t >= known.current.max && fly?.id !== m.id) fresh.add(m.id);

  useLayoutEffect(() => {
    const el = ref.current!;
    const switched = known.current.chat !== c.id;
    const prevMax = known.current.max;
    const added = msgs.filter((m) => !known.current.ids.has(m.id) && m.t >= prevMax);
    known.current = { chat: c.id, ids: new Set(msgs.map((m) => m.id)), max: msgs.reduce((x, m) => Math.max(x, m.t), 0) };
    if (switched) {
      anchor.current = null;
      el.scrollTop = el.scrollHeight;
      if (c.hasMore && el.scrollHeight <= el.clientHeight + 40) loadOlder(c.id); // short screen: fill it
      return;
    }
    if (anchor.current) { // older page landed above: keep the same messages in view
      el.scrollTop = anchor.current.top + (el.scrollHeight - anchor.current.h);
      if (!olderLoading) anchor.current = null;
    }
    if (!added.length) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 400 + 200 * added.length;
    const mine = added.some((m) => m.from === 'me');
    const f = fly && added.find((m) => m.id === fly.id);
    if (f && fly && !prefersReducedMotion()) {
      el.scrollTop = el.scrollHeight;
      const node = document.getElementById('m-' + f.id), stk = node?.querySelector<HTMLElement>('.stk');
      if (stk?.animate) {
        const r = stk.getBoundingClientRect(), dx = fly.rect.right - 12 - r.right, dy = fly.rect.top - r.top;
        stk.animate([{ transform: `translate(${dx}px,${dy}px) scale(.82)`, opacity: 0.15, filter: 'blur(3px)' }, { transform: 'translate(0,-6px) scale(1.02)', opacity: 1, filter: 'blur(0)', offset: 0.72 }, { transform: 'none', opacity: 1 }], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' });
        node!.querySelector('.meta')?.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 0, offset: 0.6 }, { opacity: 1, transform: 'none' }], { duration: 700 });
      }
    } else if (near || mine) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  });

  useEffect(() => { if (swapN) replay(paneRef.current, 'swap'); }, [swapN]);
  useEffect(() => {
    if (!flash) return;
    const el = document.getElementById('m-' + flash.id);
    if (el) { el.scrollIntoView({ block: 'center' }); replay(el, 'flash'); }
  }, [flash]);

  const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes('Files');
  return (
    <section className="pane" id="convo" ref={paneRef}
      onDragEnter={(e) => { if (!hasFiles(e)) return; e.preventDefault(); setDrag((n) => n + 1); }}
      onDragOver={(e) => { if (hasFiles(e)) e.preventDefault(); }}
      onDragLeave={() => setDrag((n) => Math.max(0, n - 1))}
      onDrop={(e) => { e.preventDefault(); setDrag(0); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}>
      <div className="msgs" ref={ref} role="log" aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop < 160 && c.hasMore && !olderLoading) { anchor.current = { h: el.scrollHeight, top: el.scrollTop }; loadOlder(c.id); }
        }}>
        {c.hasMore && msgs.length ? (
          <div className="older">
            {olderLoading ? <span>Loading earlier messages…</span>
              : <button onClick={() => { const el = ref.current!; anchor.current = { h: el.scrollHeight, top: el.scrollTop }; loadOlder(c.id); }}>Load earlier messages</button>}
          </div>
        ) : null}
        {!msgs.length ? (
          <div className="empty"><I n="chats" /><b>No messages yet</b><span>Say hello to {firstName(c.name)}.</span></div>
        ) : msgs.map((m, i) => {
          const p = msgs[i - 1];
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {!p || !sameDay(p.t, m.t) ? <div className="day"><span>{dayLabel(m.t)}</span></div> : null}
              <MessageRow c={c} m={m} prev={p} next={msgs[i + 1]} isNew={fresh.has(m.id)} />
            </div>
          );
        })}
      </div>
      <Composer chat={c} pending={pending} setPending={setPending} addFiles={addFiles} />
      <div className={`drop ${drag ? 'on' : ''}`}>
        <span className="tic"><I n="upload" /></span><span>Drop to share with {firstName(c.name)}</span>
      </div>
    </section>
  );
}
