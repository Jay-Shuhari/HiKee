import type { Att, Chat, NavKey } from '../data/types';
import { I, type IconName } from '../lib/icons';
import { isMob, openViewer, setView, useApp, visibleMsgs } from '../state/store';
import { Img, thumbOf } from './common';

export const NAV: [NavKey, string, IconName][] = [
  ['pictures', 'Pictures', 'image'], ['videos', 'Videos', 'video'], ['documents', 'Documents', 'doc'], ['audio', 'Audio', 'audio'], ['media', 'Media', 'media'],
];
export const KIND: Record<NavKey, (a: Att) => boolean> = {
  pictures: (a) => a.type === 'image', videos: (a) => a.type === 'video', documents: (a) => a.type === 'doc',
  audio: (a) => a.type === 'audio', media: (a) => a.type === 'image' || a.type === 'video',
};

export function mediaItems(c: Chat, k: NavKey) {
  const out: { a: Att; m: Chat['msgs'][number]; key: string }[] = [];
  visibleMsgs(c).forEach((m) => m.atts.forEach((a, i) => { if (KIND[k](a)) out.push({ a, m, key: m.id + ':' + i }); }));
  return out.reverse();
}

export function Left({ c }: { c: Chat | null }) {
  const view = useApp((s) => s.view);
  const all = c ? visibleMsgs(c).flatMap((m) => m.atts) : [];
  const i = NAV.findIndex((n) => n[0] === view);
  const rec = c ? mediaItems(c, 'media').slice(0, 6) : [];
  return (
    <aside className="left" aria-label="Shared content">
      <div className="brand"><img className="logo" src="/logo.png" alt="" /><b>HiKee</b></div>
      <div className="mhead"><h2>Media</h2><span>{c ? 'Shared with ' + c.name : 'No chat selected'}</span></div>
      <div>
        <nav className="nav">
          <span className="ind" style={{ transform: `translateY(${Math.max(0, i) * 52}px)`, opacity: i < 0 ? 0 : 1 }} />
          {NAV.map(([k, l, ic]) => (
            <button key={k} className={`ni ${view === k ? 'on' : ''}`} title={l} aria-pressed={view === k} disabled={!c}
              onClick={() => setView(view === k && !isMob() ? null : k)}>
              <I n={ic} /><span className="lbl">{l}</span><span className="cnt">{all.filter(KIND[k]).length || ''}</span>
            </button>
          ))}
        </nav>
        <div className="mrecent">
          {rec.length ? <h3>Recent</h3> : null}
          {rec.map((it, k) => {
            const [src, key] = thumbOf(it.a);
            return (
              <button key={it.key} style={{ animationDelay: k * 40 + 'ms' }} aria-label={'Open ' + (it.a.name || 'item')}
                onClick={() => openViewer(mediaItems(c!, 'media').map((x) => x.a), k)}>
                <Img src={src} k={key} />{it.a.type === 'video' ? <span className="play"><I n="play" /></span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
