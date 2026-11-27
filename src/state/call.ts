/* Voice/video calls. AWS mode: peer-to-peer WebRTC, with offers/answers/ICE exchanged through
   AppSync (CallSignal). Demo mode: a simulated ringing screen like the original. */
import type { Signal } from '../data/backend';
import type { Chat } from '../data/types';
import { uuid } from '../lib/format';
import { isMob, openChat, setView, toast, useApp, type CallState } from './store';

const ICE: RTCIceServer[] = (import.meta.env.VITE_ICE_SERVERS ? JSON.parse(import.meta.env.VITE_ICE_SERVERS) : null) || [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

let pc: RTCPeerConnection | null = null;
let pendingIce: RTCIceCandidateInit[] = [];
let offer: RTCSessionDescriptionInit | null = null;
let timers: number[] = [];
let ringTone: { stop(): void } | null = null;

const get = () => useApp.getState();
const patch = (p: Partial<CallState>) => { const c = get().call; if (c) useApp.setState({ call: { ...c, ...p } }); };
const chatOf = (id: string) => get().chats.find((c) => c.id === id) || null;

function sig(chat: Chat, kind: Signal['kind'], callId: string, payload?: unknown) {
  const s = get();
  return s.backend!.signal(s.me!, chat, { kind, callId, payload }).catch((e) => console.warn('[HiKee] signal failed', e));
}

function tone(incoming: boolean) {
  try {
    const ctx = new AudioContext();
    let on = true;
    const beep = () => {
      if (!on) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = incoming ? 660 : 440; g.gain.value = 0.05;
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (incoming ? 0.35 : 1));
    };
    beep();
    const iv = window.setInterval(beep, incoming ? 1200 : 3000);
    return { stop() { on = false; clearInterval(iv); ctx.close().catch(() => {}); } };
  } catch { return null; }
}

async function media(kind: 'voice' | 'video') {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false });
}

function newPc(chat: Chat, callId: string) {
  const p = new RTCPeerConnection({ iceServers: ICE });
  p.onicecandidate = (e) => { if (e.candidate) sig(chat, 'ice', callId, e.candidate.toJSON()); };
  p.ontrack = (e) => { patch({ remote: e.streams[0] }); };
  p.onconnectionstatechange = () => {
    const st = p.connectionState;
    if (st === 'connected') { ringTone?.stop(); ringTone = null; patch({ phase: 'connected', status: '', startedAt: Date.now() }); }
    if (st === 'failed') { toast('The call couldn’t connect. One of you may be behind a strict firewall.'); hangUp(true); }
    if (st === 'disconnected') patch({ status: 'Reconnecting…' });
  };
  return p;
}

async function flushIce() {
  if (!pc?.remoteDescription) return;
  for (const c of pendingIce) await pc.addIceCandidate(c).catch(() => {});
  pendingIce = [];
}

export async function startCall(kind: 'voice' | 'video') {
  const s = get();
  const chat = s.chats.find((c) => c.id === s.active);
  if (!chat || s.call) return;
  const callId = uuid();
  if (s.backend?.mode !== 'aws') {
    useApp.setState({ call: { chatId: chat.id, callId, kind, phase: 'outgoing', status: kind === 'video' ? 'Starting video call…' : 'Calling…', mic: true, cam: kind === 'video', demo: true } });
    timers.push(window.setTimeout(() => patch({ status: 'Ringing…' }), 1400));
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { toast('Calls need a browser with camera and microphone support.'); return; }
  useApp.setState({ call: { chatId: chat.id, callId, kind, phase: 'outgoing', status: 'Starting…', mic: true, cam: kind === 'video' } });
  let local: MediaStream;
  try { local = await media(kind); } catch {
    useApp.setState({ call: null });
    toast(kind === 'video' ? 'Camera or microphone access was blocked.' : 'Microphone access was blocked.');
    return;
  }
  if (get().call?.callId !== callId) { local.getTracks().forEach((t) => t.stop()); return; }
  patch({ local, status: 'Calling…' });
  pc = newPc(chat, callId);
  local.getTracks().forEach((t) => pc!.addTrack(t, local));
  const o = await pc.createOffer();
  await pc.setLocalDescription(o);
  await sig(chat, 'offer', callId, { sdp: o, kind });
  patch({ status: 'Ringing…' });
  ringTone = tone(false);
  timers.push(window.setTimeout(() => { if (get().call?.callId === callId && get().call?.phase === 'outgoing') { toast('No answer'); hangUp(true); } }, 45_000));
}

export async function acceptCall() {
  const c = get().call, chat = c && chatOf(c.chatId);
  if (!c || !chat || c.phase !== 'incoming' || !offer) return;
  ringTone?.stop(); ringTone = null;
  patch({ phase: 'connecting', status: 'Connecting…' });
  let local: MediaStream;
  try { local = await media(c.kind); } catch {
    toast('Camera or microphone access was blocked.');
    sig(chat, 'decline', c.callId); cleanup(); return;
  }
  patch({ local });
  pc = newPc(chat, c.callId);
  local.getTracks().forEach((t) => pc!.addTrack(t, local));
  await pc.setRemoteDescription(offer);
  await flushIce();
  const ans = await pc.createAnswer();
  await pc.setLocalDescription(ans);
  await sig(chat, 'answer', c.callId, { sdp: ans });
}

export function declineCall() {
  const c = get().call, chat = c && chatOf(c.chatId);
  if (c && chat && !c.demo) sig(chat, 'decline', c.callId);
  cleanup();
}

export function hangUp(silent = false, tellPeer = true) {
  const c = get().call;
  if (!c) return;
  const chat = chatOf(c.chatId);
  if (!c.demo && chat && tellPeer) sig(chat, 'end', c.callId);
  const secs = c.startedAt ? Math.round((Date.now() - c.startedAt) / 1000) : 0;
  cleanup();
  if (!silent) toast(secs ? `Call ended · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : 'Call ended');
}

export function toggleMic() {
  const c = get().call; if (!c) return;
  const on = !c.mic; c.local?.getAudioTracks().forEach((t) => (t.enabled = on)); patch({ mic: on });
}
export function toggleCam() {
  const c = get().call; if (!c) return;
  const on = !c.cam; c.local?.getVideoTracks().forEach((t) => (t.enabled = on)); patch({ cam: on });
}

function cleanup() {
  timers.forEach(clearTimeout); timers = [];
  ringTone?.stop(); ringTone = null;
  const c = get().call;
  c?.local?.getTracks().forEach((t) => t.stop());
  pc?.close(); pc = null; pendingIce = []; offer = null;
  useApp.setState({ call: null });
}

export async function onSignal(s: Signal) {
  const c = get().call;
  const chat = chatOf(s.chatId);
  if (!chat) return;
  if (s.kind === 'offer') {
    if (c) { sig(chat, 'busy', s.callId); return; }
    const p = s.payload as { sdp: RTCSessionDescriptionInit; kind: 'voice' | 'video' };
    offer = p.sdp; pendingIce = [];
    useApp.setState({ call: { chatId: chat.id, callId: s.callId, kind: p.kind, phase: 'incoming', status: p.kind === 'video' ? 'Incoming video call' : 'Incoming voice call', mic: true, cam: p.kind === 'video' } });
    if (get().active !== chat.id) openChat(chat.id);
    if (get().view) setView(null);
    if (isMob()) useApp.setState({ page: 'chat' });
    ringTone = tone(true);
    timers.push(window.setTimeout(() => { if (get().call?.callId === s.callId && get().call?.phase === 'incoming') cleanup(); }, 45_000));
    return;
  }
  if (!c || c.callId !== s.callId) return;
  if (s.kind === 'answer' && pc) {
    ringTone?.stop(); ringTone = null;
    patch({ phase: 'connecting', status: 'Connecting…' });
    await pc.setRemoteDescription((s.payload as { sdp: RTCSessionDescriptionInit }).sdp);
    await flushIce();
  } else if (s.kind === 'ice') {
    const cand = s.payload as RTCIceCandidateInit;
    if (pc?.remoteDescription) await pc.addIceCandidate(cand).catch(() => {});
    else pendingIce.push(cand);
  } else if (s.kind === 'end') {
    hangUp(false, false);
  } else if (s.kind === 'decline' || s.kind === 'busy') {
    cleanup();
    toast(s.kind === 'busy' ? `${chat.name.split(' ')[0]} is on another call` : `${chat.name.split(' ')[0]} declined the call`);
  }
}
