/* Icons: Streamline Flex where available (extracted at build time into sf-icons.json
   by `npm run icons`), hand-drawn fallbacks in the same stroke style otherwise. */
import sfData from './sf-icons.json';

const P = {
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/>',
  cam: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/>',
  camOff: '<path d="M15.5 13.5v1.5a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h1M10 6h2.5a3 3 0 0 1 3 3v1.5l6-3.5v10M3 3l18 18"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  audio: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  media: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  phone: '<path d="M5 4h3.5l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5l1.5-2.5 5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  more: '<circle cx="12" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="19" r="1.3" fill="currentColor"/>',
  clip: '<path d="M21 11.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
  micOff: '<path d="M15 9.5V6a3 3 0 0 0-5.8-1M9 9v2a3 3 0 0 0 5 2.2M5.5 11a6.5 6.5 0 0 0 10.7 5M18.5 11a6.5 6.5 0 0 1-.4 2.2M12 17.5V21M9 21h6M3 3l18 18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checks: '<path d="M2 12.5l4.5 4.5L16 7.5M11.5 16l1 1L22 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  bellOff: '<path d="M18 8a6 6 0 0 0-9.3-5M6 8c0 7-3 9-3 9h14M13.7 21a2 2 0 0 1-3.4 0M3 3l18 18"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  chats: '<path d="M4 5h16v11H9l-5 4z"/>',
  down: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>',
  upload: '<path d="M12 16V4M6 9l6-6 6 6M5 20h14"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
} as const;

export type IconName = keyof typeof P;

/** Streamline Flex names for the icons that have a counterpart in that set. */
export const SFN: Partial<Record<IconName, string>> = {
  image: 'landscape-2', video: 'camera-video', cam: 'webcam', doc: 'text-file', pdf: 'pdf-reader-application',
  audio: 'music-note-circle', media: 'polaroid-four', search: 'magnifying-glass', phone: 'phone', clip: 'paperclip-1',
  smile: 'happy-face', logout: 'logout-1', down: 'download-arrow', bellOff: 'disable-bell-notification', bell: 'bell',
  trash: 'recycle-bin-3', chats: 'chat-bubble-text-square', upload: 'upload-box-1',
};

const SF = sfData as Record<string, { body: string; w: number; h: number }>;

export function iconSvg(n: IconName, c = '') {
  const s = SF[n];
  return s
    ? `<svg class="i sf ${c}" viewBox="0 0 ${s.w} ${s.h}" aria-hidden="true">${s.body}</svg>`
    : `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
}

export function I({ n, c = '' }: { n: IconName; c?: string }) {
  const s = SF[n];
  if (s) return <svg className={`i sf ${c}`} viewBox={`0 0 ${s.w} ${s.h}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: s.body }} />;
  return <svg className={`i ${c}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[n] }} />;
}
