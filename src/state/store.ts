import { create } from 'zustand';
import type { Backend, BackendEvents, Conn } from '../data/backend';
import type { Att, Chat, Me, Msg, MsgStatus, NavKey, Page, Person, ThemePref } from '../data/types';
import { loadBackend } from '../data';
import type { Pending } from '../lib/files';
import { uuid } from '../lib/format';
import { onSignal } from './call';
import { stopAudio } from './audio';

export interface Toast { id: number; msg: string; label?: string; fn?: () => void }
export interface Confirm { title: string; body: string; ok: string; cls?: string; fn: () => void }
export interface Viewer { items: Att[]; i: number }
export interface CallState {
  chatId: string;
  callId: string;
  kind: 'voice' | 'video';
  phase: 'outgoing' | 'incoming' | 'connecting' | 'connected';
  status: string;
  startedAt?: number;
  mic: boolean;
  cam: boolean;
  local?: MediaStream | null;
  remote?: MediaStream | null;
  demo?: boolean;
}

export interface AppState {
  backend: Backend | null;
  phase: 'boot' | 'out' | 'in';
  me: Me | null;
  chats: Chat[];
  active: string | null;
  view: NavKey | null;
  page: Page;
  q: string;
  muted: string[];
  theme: ThemePref;
  people: Person[];
  toast: Toast | null;
  confirm: Confirm | null;
  viewer: Viewer | null;
  call: CallState | null;
  /** Message to scroll to + flash (search hit). */
  flash: { id: string; n: number } | null;
  /** Where the composer was when a message was sent, for the fly-in animation. */
  fly: { id: string; rect: DOMRect } | null;
  /** Bumped whenever the visible conversation is swapped (for the swap animation). */
  swapN: number;
  /** Realtime WebSocket state. */
  conn: Conn;
  /** Chat whose earlier messages are being fetched. */
  olderLoading: string | null;
}

const initialTheme = (localStorage.getItem('hikee-theme') as ThemePref) || 'system';

export const useApp = create<AppState>(() => ({
  backend: null,
  phase: 'boot',
  me: null,
  chats: [],
  active: null,
  view: null,
  page: 'home',
  q: '',
  muted: [],
  theme: initialTheme,
  people: [],
  toast: null,
  confirm: null,
  viewer: null,
  call: null,
  flash: null,
  fly: null,
  swapN: 0,
  conn: 'connecting',
  olderLoading: null,
}));

const get = useApp.getState;
const set = useApp.setState;

/* ---------- selectors ---------- */
export const lastT = (c: Chat) => c.msgs.at(-1)?.t || c.at || 0;
export const visibleMsgs = (c: Chat) => (c.clearedAt ? c.msgs.filter((m) => m.t > c.clearedAt!) : c.msgs);
export const sortChats = (cs: Chat[]) => [...cs].sort((a, b) => lastT(b) - lastT(a));
export const curChat = (s: AppState = get()) => s.chats.find((c) => c.id === s.active) || null;
export const effStatus = (c: Chat, m: Msg): MsgStatus =>
  m.status === 'delivered' && c.peerReadAt && c.peerReadAt >= m.t ? 'read' : m.status;
export const isMob = () => matchMedia('(max-width:780px)').matches;

function patchChat(id: string, fn: (c: Chat) => Chat) {
  set((s) => ({ chats: s.chats.map((c) => (c.id === id ? fn(c) : c)) }));
}
function patchMsg(chatId: string, msgId: string, fn: (m: Msg) => Msg) {
  patchChat(chatId, (c) => ({ ...c, msgs: c.msgs.map((m) => (m.id === msgId ? fn(m) : m)) }));
}

/* ---------- toast / confirm ---------- */
let toastN = 0;
export function toast(msg: string, label?: string, fn?: () => void) {
  set({ toast: { id: ++toastN, msg, label, fn } });
}
export function confirmBox(title: string, body: string, ok: string, cls: string | undefined, fn: () => void) {
  set({ confirm: { title, body, ok, cls, fn } });
}

/* ---------- theme ---------- */
export function setTheme(t: ThemePref) {
  localStorage.setItem('hikee-theme', t);
  set({ theme: t });
}

/* ---------- boot / auth ---------- */
let stopRealtime: (() => void) | null = null;

export async function boot() {
  const backend = await loadBackend();
  set({ backend });
  let me: Me | null = null;
  try { me = await backend.currentUser(); } catch (e) { console.warn(e); }
  if (me) await enter(me);
  else set({ phase: 'out' });
}

export async function enter(me: Me) {
  const b = get().backend!;
  let res: { chats: Chat[]; muted: string[] };
  try { res = await b.loadChats(me); } catch (e) {
    console.error(e);
    res = { chats: [], muted: [] };
    toast('Couldn’t load your chats. Check your connection and try again.');
  }
  const chats = sortChats(res.chats);
  set({ me, chats, muted: res.muted, active: chats[0]?.id || null, phase: 'in', view: null, page: 'home', q: '', people: [] });
  stopRealtime?.();
  stopRealtime = b.start(me, events);
  const c = curChat();
  if (c && !isMob()) markRead(c);
}

export async function logout() {
  stopAudio();
  stopRealtime?.(); stopRealtime = null;
  await get().backend?.signOut().catch(() => {});
  set({ phase: 'out', me: null, chats: [], active: null, call: null, viewer: null, view: null });
}

/* ---------- realtime events ---------- */
const presenceTimer = window.setInterval(() => {
  const now = Date.now();
  if (get().backend?.mode !== 'aws') return;
  set((s) => ({ chats: s.chats.map((c) => { const on = !!c.seen && now - c.seen < 90_000; return on === c.online ? c : { ...c, online: on }; }) }));
}, 30_000);
void presenceTimer;

function chatIsOnScreen(id: string) {
  const s = get();
  return s.active === id && !s.view && document.visibilityState === 'visible' && (!isMob() || s.page === 'chat');
}

function notify(c: Chat, m: Msg) {
  if (get().muted.includes(c.id)) return;
  if (document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const body = m.text || (m.atts[0] ? (m.atts[0].type === 'image' ? 'Photo' : m.atts[0].type === 'video' ? 'Video' : m.atts[0].type === 'audio' ? 'Voice message' : m.atts[0].name) : '');
  try { new Notification(c.name, { body, icon: '/logo.png', tag: c.id }); } catch { /* ignore */ }
}

const events: BackendEvents = {
  connection(state) {
    const was = get().conn;
    set({ conn: state });
    // back online: resend anything that failed while the socket was down
    if (state === 'live' && was !== 'live') {
      for (const c of get().chats) for (const m of c.msgs) if (m.status === 'failed') deliver(c.id, m.id);
    }
  },
  message(chatId, msg) {
    const c = get().chats.find((x) => x.id === chatId);
    if (!c) return;
    if (c.msgs.some((m) => m.id === msg.id)) return;
    const onScreen = chatIsOnScreen(chatId);
    patchChat(chatId, (x) => ({ ...x, msgs: [...x.msgs, msg].sort((a, b) => a.t - b.t), unread: msg.from === 'them' && !onScreen ? x.unread + 1 : x.unread }));
    set((s) => ({ chats: sortChats(s.chats) }));
    if (msg.from === 'them') {
      if (onScreen) markRead(curChat()!);
      notify(c, msg);
    }
  },
  chat(chat) {
    set((s) => {
      if (s.chats.some((c) => c.id === chat.id)) return s;
      return { chats: sortChats([...s.chats, chat]), active: s.active || chat.id };
    });
    const m = chat.msgs.at(-1);
    if (m && m.from === 'them') notify(chat, m);
  },
  presence(peerId, seen) {
    set((s) => ({ chats: s.chats.map((c) => (c.peerId === peerId ? { ...c, seen, online: Date.now() - seen < 90_000 } : c)) }));
  },
  peerRead(chatId, at) {
    patchChat(chatId, (c) => ({ ...c, peerReadAt: Math.max(c.peerReadAt || 0, at) }));
  },
  status(chatId, msgId, status) {
    patchMsg(chatId, msgId, (m) => ({ ...m, status }));
  },
  signal(s) { onSignal(s); },
};

document.addEventListener('visibilitychange', () => {
  const c = curChat();
  if (c && chatIsOnScreen(c.id) && c.unread) markRead(c);
});

/* ---------- navigation ---------- */
export function markRead(c: Chat) {
  const s = get();
  if (c.unread) patchChat(c.id, (x) => ({ ...x, unread: 0 }));
  const last = c.msgs.at(-1);
  if (s.me && last) s.backend?.markRead(s.me, c, Math.max(last.t, Date.now()));
}

export function setPage(p: Page) {
  const s = get();
  if (p === s.page) return;
  if (p !== 'chat') stopAudio();
  set({ page: p });
  if (p === 'chat') { const c = curChat(); if (c?.unread) markRead(c); }
}

export function setView(v: NavKey | null) {
  stopAudio();
  set((s) => ({ view: v, swapN: s.swapN + 1 }));
  if (isMob() && v) setPage('chat');
  if (!v) { const c = curChat(); if (c?.unread) markRead(c); }
}

export function openChat(id: string, hitMsgId?: string) {
  const s = get();
  const c = s.chats.find((x) => x.id === id);
  if (!c) return;
  const changed = id !== s.active;
  if (changed) stopAudio();
  let view = s.view;
  if (isMob() && view) view = null;
  else if (view && !changed) view = null;
  set({ active: id, view, swapN: changed || view !== s.view ? s.swapN + 1 : s.swapN, flash: hitMsgId && !view ? { id: hitMsgId, n: Date.now() } : null });
  if (isMob()) setPage('chat');
  if (!view && (!isMob() || get().page === 'chat')) markRead(get().chats.find((x) => x.id === id)!);
}

/* ---------- search + people ---------- */
let searchT = 0;
export function setQuery(q: string) {
  set({ q });
  const s = get();
  clearTimeout(searchT);
  if (s.backend?.mode !== 'aws' || q.trim().length < 2) { set({ people: [] }); return; }
  searchT = window.setTimeout(async () => {
    try {
      const people = await s.backend!.searchPeople(s.me!, q);
      if (get().q === q) set({ people: people.filter((p) => !get().chats.some((c) => c.peerId === p.id)) });
    } catch (e) { console.warn(e); }
  }, 300);
}

export async function startChatWith(p: Person) {
  const s = get();
  try {
    const chat = await s.backend!.openChatWith(s.me!, p);
    chat.at = chat.at || Date.now();
    set((x) => ({ chats: x.chats.some((c) => c.id === chat.id) ? x.chats : sortChats([chat, ...x.chats]), q: '', people: [] }));
    openChat(chat.id);
  } catch (e) {
    toast('Couldn’t start a chat: ' + (e as Error).message);
  }
}

/* ---------- history ---------- */
/** Fetch the page of messages before the oldest one loaded (scrolling up). */
export async function loadOlder(chatId: string) {
  const s = get();
  const c = s.chats.find((x) => x.id === chatId);
  if (!c || !c.hasMore || !s.me || s.olderLoading === chatId || !c.msgs.length) return;
  set({ olderLoading: chatId });
  try {
    const { msgs, more } = await s.backend!.loadOlder(s.me, c, c.msgs[0].t);
    patchChat(chatId, (x) => {
      const ids = new Set(x.msgs.map((m) => m.id));
      const fresh = msgs.filter((m) => !ids.has(m.id));
      const hidden = !!x.clearedAt && fresh.some((m) => m.t <= x.clearedAt!); // reached the "cleared" point
      return { ...x, msgs: [...fresh, ...x.msgs], hasMore: more && fresh.length > 0 && !hidden };
    });
  } catch (e) {
    console.warn(e);
    toast('Couldn’t load earlier messages.');
  } finally {
    set({ olderLoading: null });
  }
}

/* ---------- sending ---------- */
export async function send(text: string, pend: Pending[], from?: DOMRect) {
  const s = get();
  const c = curChat(s);
  if (!c || !s.me) return;
  await Promise.all(pend.map((p) => p.ready));
  const msg: Msg = { id: uuid(), from: 'me', t: Date.now(), text, atts: pend.map((p) => p.a), status: 'sending' };
  patchChat(c.id, (x) => ({ ...x, msgs: [...x.msgs, msg] }));
  set((x) => ({ chats: sortChats(x.chats), fly: from ? { id: msg.id, rect: from } : null }));
  if ('Notification' in window && Notification.permission === 'default' && s.backend?.mode === 'aws') Notification.requestPermission().catch(() => {});
  await deliver(c.id, msg.id);
}

async function deliver(chatId: string, msgId: string) {
  const s = get();
  const c = s.chats.find((x) => x.id === chatId);
  const m = c?.msgs.find((x) => x.id === msgId);
  if (!c || !m || !s.me) return;
  patchMsg(chatId, msgId, (x) => ({ ...x, status: 'sending' }));
  try {
    const hasFiles = m.atts.some((a) => a.file);
    const stored = await s.backend!.send(s.me, c, m, (p) => { if (hasFiles) patchMsg(chatId, msgId, (x) => ({ ...x, progress: p })); });
    patchMsg(chatId, msgId, (x) => ({ ...x, ...stored, atts: stored.atts.map((a, i) => ({ ...x.atts[i], ...a })), progress: undefined }));
  } catch (e) {
    console.error(e);
    patchMsg(chatId, msgId, (x) => ({ ...x, status: 'failed', progress: undefined }));
    toast('Message not sent. Tap “Retry” to try again.');
  }
}
export const retry = deliver;

/** Post an already-built attachment (voice notes). */
export function postAtt(a: Att, from?: DOMRect) {
  return send('', [{ id: 0, a, ready: Promise.resolve() }], from);
}

/* ---------- chat actions ---------- */
export function toggleMute(id: string) {
  const s = get();
  const muted = s.muted.includes(id) ? s.muted.filter((x) => x !== id) : [...s.muted, id];
  set({ muted });
  if (s.me) s.backend?.setMuted(s.me, muted);
  const c = s.chats.find((x) => x.id === id)!;
  toast(muted.includes(id) ? `Notifications muted for ${c.name}` : `Notifications on for ${c.name}`);
}

export function clearChat(id: string) {
  const s = get();
  const c = s.chats.find((x) => x.id === id)!;
  confirmBox('Clear this chat?', `All messages with ${c.name} will be removed for you. ${c.name.split(' ')[0]} keeps their copy.`, 'Clear chat', 'red', async () => {
    const prev = c.clearedAt, at = Date.now();
    stopAudio();
    patchChat(id, (x) => ({ ...x, clearedAt: at, unread: 0 }));
    s.backend?.clear(s.me!, c, at).catch(() => toast('Couldn’t sync the cleared chat.'));
    toast('Chat cleared', 'Undo', () => {
      patchChat(id, (x) => ({ ...x, clearedAt: prev }));
      s.backend?.clear(s.me!, c, prev).catch(() => {});
    });
  });
}

/* ---------- viewer ---------- */
export function openViewer(items: Att[], i: number) {
  if (!items.length) return;
  set({ viewer: { items, i } });
}
export function closeViewer() { set({ viewer: null }); }
