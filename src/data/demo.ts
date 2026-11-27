/* In-browser backend used when amplify_outputs.json is absent: sample chats, simulated
   delivery/read receipts. Nothing leaves the device. */
import type { Backend, BackendEvents } from './backend';
import type { Me } from './types';
import { sampleChats } from './sample';

let ev: BackendEvents | null = null;

export const demoBackend: Backend = {
  mode: 'demo',
  async currentUser() {
    return sessionStorage.getItem('hikee-demo-out') ? null : demoMe;
  },
  async signIn() { sessionStorage.removeItem('hikee-demo-out'); return 'done'; },
  async signUp() { return 'done'; },
  async confirmSignUp() {},
  async resendCode() {},
  async forgotPassword() {},
  async resetPassword() {},
  async signOut() { sessionStorage.setItem('hikee-demo-out', '1'); },

  async loadChats() {
    let muted: string[] = [];
    try { muted = JSON.parse(localStorage.getItem('hikee-demo-muted') || '[]'); } catch { /* ignore */ }
    return { chats: sampleChats(), muted };
  },
  start(_me, events) {
    ev = events;
    events.connection('local');
    return () => { ev = null; };
  },
  async send(_me, chat, msg) {
    const out = { ...msg, status: 'sent' as const };
    setTimeout(() => ev?.status(chat.id, msg.id, 'delivered'), 800);
    if (chat.online) setTimeout(() => ev?.status(chat.id, msg.id, 'read'), 2300);
    return out;
  },
  async loadOlder() { return { msgs: [], more: false }; },
  markRead() {},
  async clear() {},
  setMuted(_me, muted) { localStorage.setItem('hikee-demo-muted', JSON.stringify(muted)); },
  async searchPeople() { return []; },
  async openChatWith() { throw new Error('Not available in demo mode'); },
  async url(key) { return key; },
  async signal() {},
};

const demoMe: Me = { id: 'me', name: 'You', color: '#3d50e0' };
