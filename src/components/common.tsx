import { useEffect, useState } from 'react';
import type { Att, Chat } from '../data/types';
import { extOf, extColor, initials } from '../lib/format';
import { dataUrlToBlob, makePdf } from '../lib/files';
import { toast, useApp } from '../state/store';

export function Avatar({ c, sz, dot = true, cls = '' }: { c: Pick<Chat, 'name' | 'color'> & { online?: boolean }; sz: number; dot?: boolean; cls?: string }) {
  return (
    <span className={`av ${cls}`} style={{ width: sz, height: sz, fontSize: Math.round(sz * 0.36) }}>
      <span style={{ background: c.color }}>{initials(c.name)}</span>
      {dot && c.online ? <i className="on" title="Online" /> : null}
    </span>
  );
}

export function ExtBadge({ name }: { name: string }) {
  return <span className="ext" style={{ background: extColor(name) }}>{extOf(name)}</span>;
}

/** Resolve a displayable URL: a local one if present, otherwise the S3 key through the backend. */
export function useUrl(local?: string, key?: string) {
  const backend = useApp((s) => s.backend);
  const [url, setUrl] = useState<string | undefined>(local);
  useEffect(() => {
    if (local) { setUrl(local); return; }
    if (!key || !backend) { setUrl(undefined); return; }
    let live = true;
    backend.url(key).then((u) => live && setUrl(u)).catch(() => {});
    return () => { live = false; };
  }, [local, key, backend]);
  return url;
}

export function Img({ src, k, alt = '', ...rest }: { src?: string; k?: string; alt?: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const url = useUrl(src, k);
  return url ? <img src={url} alt={alt} {...rest} /> : <span className="imgph" />;
}

/** Poster/thumbnail URL for media tiles. */
export const thumbOf = (a: Att): [string | undefined, string | undefined] =>
  a.type === 'image' ? [a.src, a.key] : [a.poster, a.posterKey];

async function blobFor(a: Att): Promise<Blob | null> {
  if (a.file) return a.file;
  if (a.src?.startsWith('data:')) return dataUrlToBlob(a.src);
  if (a.pdf && a.pv) return makePdf(a.pv);
  const key = a.key;
  if (key) {
    const url = await useApp.getState().backend!.url(key);
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.blob();
  }
  return null;
}

export const canDownload = (a?: Att) => !!a && !!(a.file || a.src?.startsWith('data:') || (a.pdf && a.pv) || a.key);

export async function download(a: Att) {
  let data: Blob | null = null;
  try { data = await blobFor(a); } catch { toast(`Couldn’t download ${a.name}.`); return; }
  if (!data) { toast(`${a.name} is sample content with no file behind it.`); return; }
  const name = a.name.includes('.') ? a.name : a.name + (data.type.includes('webm') ? '.webm' : data.type.includes('ogg') ? '.ogg' : data.type.includes('mp4') ? '.m4a' : '');
  const url = URL.createObjectURL(data), l = document.createElement('a');
  l.href = url; l.download = name; document.body.appendChild(l); l.click(); l.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function replay(el: Element | null, cls: string) {
  if (!el) return;
  el.classList.remove(cls); void (el as HTMLElement).offsetWidth; el.classList.add(cls);
}
