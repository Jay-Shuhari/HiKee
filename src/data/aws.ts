/* AWS backend: Cognito (auth), AppSync + DynamoDB (chats, messages, read marks, call
   signalling) and S3 (attachments). Requires amplify_outputs.json.
   Realtime: every subscription below shares ONE WebSocket to AppSync's realtime endpoint
   (wss://<api>.appsync-realtime-api.<region>.amazonaws.com/graphql). Messages, read receipts,
   presence and call signalling are all pushed over that socket — nothing polls. */
import {
  confirmResetPassword, confirmSignUp, fetchUserAttributes, getCurrentUser, resendSignUpCode,
  resetPassword, signIn, signOut, signUp,
} from 'aws-amplify/auth';
import { CONNECTION_STATE_CHANGE, ConnectionState, generateClient } from 'aws-amplify/data';
import { getUrl, uploadData } from 'aws-amplify/storage';
import { Hub } from 'aws-amplify/utils';
import type { Schema } from '../../amplify/data/resource';
import type { Backend, BackendEvents, Conn, SignalKind } from './backend';
import type { Att, Chat, Msg, Person } from './types';
import { colorFor, uuid } from '../lib/format';
import { dataUrlToBlob } from '../lib/files';

type Client = ReturnType<typeof generateClient<Schema>>;
let _client: Client | null = null;
const client = () => (_client ??= generateClient<Schema>());

type ConvRow = Schema['Conversation']['type'];
type MsgRow = Schema['Message']['type'];
type ProfileRow = Schema['Profile']['type'];

const convMembers = new Map<string, string[]>();
const profiles = new Map<string, ProfileRow>();
const ONLINE_MS = 90_000;

const parseJson = <T,>(v: unknown, fallback: T): T => {
  let x = v;
  for (let i = 0; i < 2 && typeof x === 'string'; i++) { try { x = JSON.parse(x); } catch { return fallback; } }
  return (x ?? fallback) as T;
};
const ts = (iso?: string | null) => (iso ? Date.parse(iso) : 0);
const peerOf = (members: (string | null)[] | null | undefined, me: string) => (members || []).find((m) => m && m !== me) || me;

function check<T extends { data: unknown; errors?: { message: string }[] }>(r: T): NonNullable<T['data']> {
  if (r.errors?.length && !r.data) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data as NonNullable<T['data']>;
}

async function listAll<T>(fn: (nextToken?: string | null) => Promise<{ data: T[]; nextToken?: string | null; errors?: { message: string }[] }>) {
  const out: T[] = [];
  let next: string | null | undefined;
  do {
    const r = await fn(next);
    if (r.errors?.length && !r.data?.length) throw new Error(r.errors[0].message);
    out.push(...(r.data || []).filter(Boolean));
    next = r.nextToken;
  } while (next);
  return out;
}

async function profile(id: string): Promise<ProfileRow | null> {
  if (profiles.has(id)) return profiles.get(id)!;
  const r = await client().models.Profile.get({ userId: id });
  if (r.data) profiles.set(id, r.data);
  return r.data;
}

function mapMsg(m: MsgRow, me: string): Msg {
  return {
    id: m.id,
    from: m.senderId === me ? 'me' : 'them',
    t: ts(m.sentAt),
    text: m.text || '',
    atts: parseJson<Att[]>(m.atts, []),
    status: 'delivered',
  };
}

const PAGE = 100;
const marksOf = (conversationId: string) => client().models.ReadMark.list({ conversationId }).then((r) => r.data || []);

async function buildChat(c: ConvRow, me: string, withMessages = true): Promise<Chat> {
  const members = (c.members || []).filter(Boolean) as string[];
  convMembers.set(c.id, members);
  const peerId = peerOf(members, me);
  let more = false;
  const [p, marks, msgs] = await Promise.all([
    profile(peerId),
    marksOf(c.id),
    withMessages
      ? client().models.Message.messagesByConversation({ conversationId: c.id }, { sortDirection: 'DESC', limit: PAGE }).then((r) => { more = !!r.nextToken; return (r.data || []).reverse(); })
      : Promise.resolve([] as MsgRow[]),
  ]);
  const mine = marks.find((m) => m.userId === me), theirs = marks.find((m) => m.userId === peerId);
  const readAt = ts(mine?.readAt), clearedAt = ts(mine?.clearedAt) || undefined;
  const list = msgs.filter((m) => members.includes(m.senderId)).map((m) => mapMsg(m, me));
  const seen = ts(p?.lastSeen);
  return {
    id: c.id,
    name: p?.name || p?.email || 'HiKee user',
    color: p?.color || colorFor(peerId),
    online: !!seen && Date.now() - seen < ONLINE_MS,
    seen: seen || undefined,
    unread: list.filter((m) => m.from === 'them' && m.t > readAt && (!clearedAt || m.t > clearedAt)).length,
    msgs: list,
    peerId,
    members,
    clearedAt,
    peerReadAt: ts(theirs?.readAt) || undefined,
    hasMore: more && (!clearedAt || (list[0]?.t || 0) > clearedAt),
  };
}

/* ---------- uploads ---------- */
const safe = (n: string) => n.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file';
async function put(data: Blob, name: string, onBytes: (n: number) => void): Promise<string> {
  const id = uuid();
  const r = await uploadData({
    path: ({ identityId }) => `media/${identityId}/${id}/${safe(name)}`,
    data,
    options: { contentType: data.type || 'application/octet-stream', onProgress: ({ transferredBytes }) => onBytes(transferredBytes) },
  }).result;
  return r.path;
}

/** Strip local-only fields and cap preview sizes so the message fits in DynamoDB. */
function wire(a: Att): Att {
  const { file: _f, src: _s, poster: _p, thumb: _t, pageImgs: _pi, ...rest } = a;
  if (rest.pv) {
    const pv = { ...rest.pv };
    if (pv.paras) pv.paras = pv.paras.slice(0, 40).map((x) => x.slice(0, 1200));
    if (pv.rows) pv.rows = pv.rows.slice(0, 60).map((r) => r.slice(0, 20).map((c) => (typeof c === 'string' ? c.slice(0, 200) : c)));
    rest.pv = pv;
  }
  return rest;
}

const marksTimers = new Map<string, number>();

/** Catch up after the WebSocket reconnects: new chats, recent messages and read receipts.
 *  The store ignores messages it already has. */
async function resync(me: { id: string }, ev: BackendEvents) {
  const convs = await listAll<ConvRow>((nextToken) => client().models.Conversation.list({ nextToken, limit: 100 }) as never);
  await Promise.all(convs.map(async (conv) => {
    if (!convMembers.has(conv.id)) { ev.chat(await buildChat(conv, me.id)); return; }
    const [msgs, marks] = await Promise.all([
      client().models.Message.messagesByConversation({ conversationId: conv.id }, { sortDirection: 'DESC', limit: 50 }).then((r) => (r.data || []).reverse()),
      marksOf(conv.id),
    ]);
    const mem = convMembers.get(conv.id)!;
    msgs.filter((m) => mem.includes(m.senderId)).forEach((m) => ev.message(conv.id, mapMsg(m, me.id)));
    const peer = marks.find((m) => m.userId !== me.id);
    if (peer?.readAt) ev.peerRead(conv.id, ts(peer.readAt));
  }));
}

export const awsBackend: Backend = {
  mode: 'aws',

  async currentUser() {
    let u;
    try { u = await getCurrentUser(); } catch { return null; }
    const attrs = await fetchUserAttributes().catch(() => ({} as Record<string, string | undefined>));
    const email = attrs.email || u.signInDetails?.loginId || '';
    const name = attrs.name || email.split('@')[0] || 'Me';
    let p = (await client().models.Profile.get({ userId: u.userId })).data;
    if (!p) {
      p = check(await client().models.Profile.create({
        userId: u.userId, email, emailLower: email.toLowerCase(), name, color: colorFor(u.userId), lastSeen: new Date().toISOString(), muted: [],
      }));
    }
    profiles.set(u.userId, p);
    return { id: u.userId, name: p.name, email, color: p.color || colorFor(u.userId) };
  },

  async signIn(email, password) {
    const go = () => signIn({ username: email.trim(), password });
    let r;
    try { r = await go(); } catch (e) {
      if ((e as Error).name === 'UserAlreadyAuthenticatedException') { await signOut(); r = await go(); } else throw e;
    }
    const step = r.nextStep.signInStep;
    if (step === 'DONE') return 'done';
    if (step === 'CONFIRM_SIGN_UP') return 'confirm';
    if (step === 'RESET_PASSWORD') return 'reset';
    throw new Error('This sign-in step is not supported: ' + step);
  },
  async signUp(name, email, password) {
    const r = await signUp({ username: email.trim(), password, options: { userAttributes: { email: email.trim(), name: name.trim() } } });
    return r.nextStep.signUpStep === 'DONE' ? 'done' : 'confirm';
  },
  async confirmSignUp(email, code) { await confirmSignUp({ username: email.trim(), confirmationCode: code.trim() }); },
  async resendCode(email) { await resendSignUpCode({ username: email.trim() }); },
  async forgotPassword(email) { await resetPassword({ username: email.trim() }); },
  async resetPassword(email, code, password) { await confirmResetPassword({ username: email.trim(), confirmationCode: code.trim(), newPassword: password }); },
  async signOut() { convMembers.clear(); profiles.clear(); await signOut(); },

  async loadChats(me) {
    const convs = await listAll<ConvRow>((nextToken) => client().models.Conversation.list({ nextToken, limit: 100 }) as never);
    const chats = await Promise.all(convs.map((c) => buildChat(c, me.id)));
    const p = profiles.get(me.id);
    return { chats, muted: ((p?.muted || []).filter(Boolean) as string[]) };
  },

  start(me, ev: BackendEvents) {
    const c = client();
    const subs: { unsubscribe(): void }[] = [];
    const onErr = (e: unknown) => console.warn('[HiKee] subscription error', e);

    subs.push(c.models.Message.onCreate().subscribe({
      next: async (m) => {
        if (!m) return;
        if (!convMembers.has(m.conversationId)) {
          const conv = (await c.models.Conversation.get({ id: m.conversationId })).data;
          if (conv) ev.chat(await buildChat(conv, me.id));
          return;
        }
        if (!convMembers.get(m.conversationId)!.includes(m.senderId)) return; // not from a member: ignore
        ev.message(m.conversationId, mapMsg(m, me.id));
      },
      error: onErr,
    }));
    subs.push(c.models.Conversation.onCreate().subscribe({
      next: async (conv) => { if (conv && !convMembers.has(conv.id)) ev.chat(await buildChat(conv, me.id)); },
      error: onErr,
    }));
    const onMark = (r: Schema['ReadMark']['type'] | null) => { if (r && r.userId !== me.id && r.readAt) ev.peerRead(r.conversationId, ts(r.readAt)); };
    subs.push(c.models.ReadMark.onCreate().subscribe({ next: onMark, error: onErr }));
    subs.push(c.models.ReadMark.onUpdate().subscribe({ next: onMark, error: onErr }));
    subs.push(c.models.Profile.onUpdate().subscribe({
      next: (p) => { if (!p) return; profiles.set(p.userId, p); if (p.userId !== me.id) ev.presence(p.userId, ts(p.lastSeen)); },
      error: onErr,
    }));
    subs.push(c.models.CallSignal.onCreate().subscribe({
      next: (s) => {
        if (!s || s.toId !== me.id) return;
        ev.signal({ chatId: s.conversationId, callId: s.callId, fromId: s.fromId, kind: s.kind as SignalKind, payload: parseJson(s.payload, null) });
        c.models.CallSignal.delete({ id: s.id }).catch(() => {});
      },
      error: onErr,
    }));

    /* WebSocket state. When the socket comes back after a drop, fetch whatever was pushed
       while we were away (the socket doesn't replay missed events). */
    let state: Conn = 'connecting', wasLive = false, wasDown = false, syncing = false;
    const setState = (s: Conn) => {
      if (s === state) return;
      state = s;
      if (s === 'live') {
        if (wasLive && wasDown && !syncing) {
          syncing = true;
          resync(me, ev).catch((e) => console.warn('[HiKee] resync failed', e)).finally(() => { syncing = false; });
        }
        wasLive = true; wasDown = false;
      } else if (wasLive) wasDown = true;
      ev.connection(s);
    };
    ev.connection(state);
    const stopHub = Hub.listen('api', ({ payload }) => {
      if (payload.event !== CONNECTION_STATE_CHANGE) return;
      const cs = (payload.data as { connectionState: ConnectionState }).connectionState;
      setState(
        cs === ConnectionState.Connected || cs === ConnectionState.ConnectedPendingKeepAlive || cs === ConnectionState.ConnectedPendingDisconnect ? 'live'
          : cs === ConnectionState.ConnectionDisruptedPendingNetwork || cs === ConnectionState.ConnectedPendingNetwork ? 'offline'
          : 'connecting',
      );
    });

    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      c.models.Profile.update({ userId: me.id, lastSeen: new Date().toISOString() }).catch(() => {});
    };
    beat();
    const iv = window.setInterval(beat, 45_000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      subs.forEach((s) => s.unsubscribe());
      stopHub();
      clearInterval(iv);
      document.removeEventListener('visibilitychange', beat);
    };
  },

  async send(me, chat, msg, onProgress) {
    const total = msg.atts.reduce((n, a) => n + (a.file?.size || 0), 0) || 1;
    const done: number[] = [];
    const bump = (i: number) => (n: number) => { done[i] = n; onProgress(Math.min(1, done.reduce((x, y) => x + (y || 0), 0) / total)); };
    const atts: Att[] = [];
    for (let i = 0; i < msg.atts.length; i++) {
      const a = { ...msg.atts[i] };
      if (a.file && !a.key) a.key = await put(a.file, a.name.includes('.') ? a.name : a.name + '.webm', bump(i));
      if (a.poster?.startsWith('data:') && !a.posterKey) a.posterKey = await put(dataUrlToBlob(a.poster), 'poster.jpg', () => {});
      if (a.pageImgs?.length && !a.pageKeys) {
        a.pageKeys = [];
        for (const [k, img] of a.pageImgs.entries()) a.pageKeys.push(await put(dataUrlToBlob(img), `page-${k + 1}.jpg`, () => {}));
        a.thumbKey = a.pageKeys[0];
      }
      atts.push(a);
    }
    const members = convMembers.get(chat.id) || chat.members || [me.id, chat.peerId!];
    const sentAt = new Date(msg.t).toISOString();
    check(await client().models.Message.create({
      id: msg.id, conversationId: chat.id, senderId: me.id, text: msg.text, atts: JSON.stringify(atts.map(wire)), sentAt, members,
    }));
    const preview = msg.text || (atts[0] ? (atts[0].type === 'image' ? 'Photo' : atts[0].type === 'video' ? 'Video' : atts[0].type === 'audio' ? 'Voice message' : atts[0].name) : '');
    client().models.Conversation.update({ id: chat.id, lastMessageAt: sentAt, lastPreview: preview.slice(0, 140) }).catch(() => {});
    return { ...msg, atts, status: 'delivered', progress: undefined };
  },

  markRead(me, chat, at) {
    clearTimeout(marksTimers.get(chat.id));
    marksTimers.set(chat.id, window.setTimeout(async () => {
      const id = { conversationId: chat.id, userId: me.id }, readAt = new Date(at).toISOString();
      const members = convMembers.get(chat.id) || chat.members || [];
      const r = await client().models.ReadMark.update({ ...id, readAt }).catch(() => null);
      if (!r?.data) await client().models.ReadMark.create({ ...id, readAt, members }).catch(() => {});
    }, 400));
  },

  async clear(me, chat, at) {
    const id = { conversationId: chat.id, userId: me.id }, clearedAt = at ? new Date(at).toISOString() : null;
    const r = await client().models.ReadMark.update({ ...id, clearedAt });
    if (!r.data) check(await client().models.ReadMark.create({ ...id, clearedAt, readAt: new Date().toISOString(), members: convMembers.get(chat.id) || chat.members || [] }));
  },

  async loadOlder(me, chat, before) {
    const r = await client().models.Message.messagesByConversation(
      { conversationId: chat.id, sentAt: { lt: new Date(before).toISOString() } },
      { sortDirection: 'DESC', limit: 50 },
    );
    if (r.errors?.length && !r.data) throw new Error(r.errors[0].message);
    const rows = r.data || [];
    const mem = convMembers.get(chat.id) || chat.members || [];
    const msgs = rows.reverse().filter((m) => mem.includes(m.senderId)).map((m) => mapMsg(m, me.id));
    return { msgs, more: !!r.nextToken };
  },

  setMuted(me, muted) {
    client().models.Profile.update({ userId: me.id, muted }).catch(() => {});
  },

  async searchPeople(me, q) {
    const ql = q.trim().toLowerCase();
    if (ql.length < 2) return [];
    const r = await client().models.Profile.list({
      filter: { or: [{ emailLower: { beginsWith: ql } }, { name: { contains: q.trim() } }, { emailLower: { eq: ql } }] },
      limit: 200,
    });
    return (r.data || [])
      .filter((p) => p.userId !== me.id)
      .slice(0, 8)
      .map((p): Person => ({ id: p.userId, name: p.name, email: p.email, color: p.color || colorFor(p.userId) }));
  },

  async openChatWith(me, p) {
    for (const [id, m] of convMembers) if (m.length === 2 && m.includes(p.id) && m.includes(me.id)) {
      const conv = (await client().models.Conversation.get({ id })).data;
      if (conv) return buildChat(conv, me.id);
    }
    const conv = check(await client().models.Conversation.create({ members: [me.id, p.id], lastMessageAt: new Date().toISOString() }));
    return buildChat(conv, me.id, false);
  },

  url: (() => {
    const cache = new Map<string, { url: string; exp: number }>();
    return async (key: string) => {
      const hit = cache.get(key);
      if (hit && hit.exp > Date.now()) return hit.url;
      const r = await getUrl({ path: key, options: { expiresIn: 3600 } });
      const url = r.url.toString();
      cache.set(key, { url, exp: Date.now() + 50 * 60_000 });
      return url;
    };
  })(),

  async signal(me, chat, s) {
    const members = convMembers.get(chat.id) || chat.members || [];
    await client().models.CallSignal.create({
      conversationId: chat.id, callId: s.callId, fromId: me.id, toId: chat.peerId!, kind: s.kind,
      payload: JSON.stringify(s.payload ?? null), members,
    });
  },
};
