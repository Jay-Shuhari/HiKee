/* Message building blocks: image grids, video cards, voice notes and document cards. */
import { useEffect, useRef } from 'react';
import type { Att, Cell, Msg } from '../data/types';
import { I } from '../lib/icons';
import { docKind, extColor, extOf, hasCard, mmss, size } from '../lib/format';
import { heardOf, peaksFor, repaint, seekAudio, toggleAudio } from '../state/audio';
import { openViewer, toast } from '../state/store';
import { download, ExtBadge, Img } from './common';

export function ImageGrid({ imgs }: { imgs: Att[] }) {
  const open = (i: number) => openViewer(imgs, i);
  const b = (a: Att, i: number, cls = '') => (
    <button key={i} className={cls} onClick={() => open(i)} aria-label={`Open image ${i + 1} of ${imgs.length}`}>
      <Img src={a.src} k={a.key} alt={a.name || 'Shared image'} loading="lazy" />
    </button>
  );
  if (imgs.length === 1) {
    const a = imgs[0], w = a.w || 4, h = a.h || 3, r = w / h, wd = r < 1 ? Math.round(340 * r) : 340;
    return (
      <div className="ig one" style={{ width: wd }}>
        <button onClick={() => open(0)} style={{ aspectRatio: `${w}/${h}` }} aria-label="Open image">
          <Img src={a.src} k={a.key} alt={a.name || 'Shared image'} />
        </button>
      </div>
    );
  }
  if (imgs.length === 2) return <div className="ig two">{imgs.map((a, i) => b(a, i))}</div>;
  const extra = imgs.length - 3;
  return (
    <div className="ig three">
      {b(imgs[0], 0)}{b(imgs[1], 1)}
      <button className="peek" onClick={() => open(2)} aria-label={`View all ${imgs.length} images`}>
        <Img src={imgs[2].src} k={imgs[2].key} />
        <span className="ov"><I n="eye" />{extra > 0 ? <b>+{extra}</b> : null}</span>
      </button>
    </div>
  );
}

export function VideoCard({ a }: { a: Att }) {
  return (
    <button className="vid" onClick={() => openViewer([a], 0)} aria-label={`Play video ${a.name}`}>
      {a.poster || a.posterKey ? <Img src={a.poster} k={a.posterKey} /> : null}
      <span className="play"><I n="play" /></span>
      <span className="dur">{mmss(a.dur || 0)}</span>
    </button>
  );
}

function Bars({ pk }: { pk: number[] }) {
  return <>{pk.map((v, i) => <i key={i} style={{ height: Math.round(14 + v * 86) + '%' }} />)}</>;
}

export function VoiceNote({ a, k }: { a: Att; k: string }) {
  const pk = peaksFor(a, k), h = heardOf(k);
  useEffect(() => { repaint(k); });
  const blocked = () => toast('This browser blocked audio playback.');
  return (
    <div className={`aud ${h.heard ? 'heard' : ''}`} data-aud={k}>
      <button className="ap" aria-label="Play voice message" onClick={() => toggleAudio(k, a, blocked)}>
        <span className="pl"><I n="play" /></span><span className="pz"><I n="pause" /></span>
      </button>
      <div className="wave" style={{ ['--p' as string]: '0%', ['--h' as string]: h.maxP * 100 + '%' }}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seekAudio(k, a, (e.clientX - r.left) / r.width); }}>
        <div className="bars"><Bars pk={pk} /></div>
        <div className="bars hfill"><Bars pk={pk} /></div>
        <div className="bars fill"><Bars pk={pk} /></div>
      </div>
      <span className="ameta"><span className="at">{mmss(a.dur || 0)}</span><span className="hd" title={h.heard ? 'Heard' : 'Not played yet'}><I n="mic" /></span></span>
    </div>
  );
}

function cells(r: Cell[], head: boolean, n: number) {
  return r.slice(0, n).map((v, i) => (head ? <th key={i}>{String(v)}</th> : <td key={i} className={typeof v === 'number' ? 'n' : undefined}>{String(v)}</td>));
}

function MiniPreview({ a }: { a: Att }) {
  if (a.thumb || a.thumbKey) return <Img src={a.thumb} k={a.thumbKey} />;
  const pv = a.pv, k = pv?.kind || docKind(a);
  if (!pv) return <span className="mp"><b>{a.name}</b><span className="rule" /><i>Preparing preview…</i></span>;
  if (k === 'sheet') return (
    <span className="ms"><span className="mtab">{pv.sheet || 'Sheet 1'}</span>
      <table><tbody>{(pv.rows || []).slice(0, 8).map((r, i) => <tr key={i}>{cells(r, i === 0, 5)}</tr>)}</tbody></table></span>
  );
  if (k === 'slides') return <span className="msl"><b>{pv.title}</b>{(pv.paras || []).slice(0, 4).map((x, i) => <i key={i}>{x}</i>)}</span>;
  return <span className="mp"><b>{pv.title}</b><span className="rule" style={{ background: extColor(a.name) }} />{(pv.paras || []).slice(0, 6).map((x, i) => <i key={i}>{x}</i>)}</span>;
}

function docCount(a: Att) {
  const pv = a.pv || ({} as NonNullable<Att['pv']>), k = pv.kind || docKind(a), n = pv.pages || a.pages || 0;
  if (k === 'sheet') { const sh = pv.sheets || 1; return sh + (sh > 1 ? ' sheets' : ' sheet'); }
  if (!n) return '';
  return n + (k === 'slides' ? (n > 1 ? ' slides' : ' slide') : n > 1 ? ' pages' : ' page');
}
function docExcerpt(a: Att) {
  const pv = a.pv;
  if (!pv) return a.excerpt || '';
  if (pv.kind === 'sheet') { const h = pv.rows?.[0] || []; return `${Math.max(0, (pv.rows?.length || 1) - 1)} rows · ${h.length} columns: ${h.join(', ')}`; }
  return pv.none ? '' : pv.paras?.[0] || a.excerpt || '';
}

export function DocCard({ a }: { a: Att }) {
  if (!hasCard(a)) return (
    <button className="doc" onClick={() => download(a)}>
      <ExtBadge name={a.name} /><span className="dn"><b>{a.name}</b><small>{size(a.size)} · {extOf(a.name)}</small></span><I n="down" />
    </button>
  );
  const k = a.pv?.kind || docKind(a), cnt = docCount(a), ex = docExcerpt(a);
  return (
    <div className="pdf">
      <button className={`pdfp k-${k}`} onClick={() => openViewer([a], 0)} aria-label={`Preview ${a.name}`}>
        <span className="page"><MiniPreview a={a} /></span>{cnt ? <span className="pgs">{cnt}</span> : null}
      </button>
      {ex ? <p className="pex">{ex}</p> : null}
      <div className="pft">
        <ExtBadge name={a.name} />
        <span className="dn"><b>{a.name}</b><small>{size(a.size)}{cnt ? ` · ${cnt}` : ''}</small></span>
        <button className="dl" onClick={() => download(a)} aria-label={`Download ${a.name}`} title="Download"><I n="down" /></button>
      </div>
    </div>
  );
}

/** All attachment blocks of one message, in the original order (image grid first). */
export function MsgBody({ m }: { m: Msg }) {
  const imgs = m.atts.filter((a) => a.type === 'image');
  return (
    <>
      {imgs.length ? <ImageGrid imgs={imgs} /> : null}
      {m.atts.map((a, i) => {
        const k = m.id + ':' + i;
        if (a.type === 'video') return <VideoCard key={k} a={a} />;
        if (a.type === 'audio') return <VoiceNote key={k} a={a} k={k} />;
        if (a.type === 'doc') return <DocCard key={k} a={a} />;
        return null;
      })}
    </>
  );
}

/** Keep a ref'd element's latest callback without re-subscribing. */
export function useLatest<T>(v: T) { const r = useRef(v); r.current = v; return r; }
