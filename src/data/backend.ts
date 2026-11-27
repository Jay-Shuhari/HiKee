import type { Chat, Me, Msg, MsgStatus, Person } from './types';

export type SignalKind = 'offer' | 'answer' | 'ice' | 'end' | 'decline' | 'busy';
export interface Signal {
  chatId: string;
  callId: string;
  fromId: string;
  kind: SignalKind;
  payload?: unknown;
}

/** Realtime link state. AWS mode: the AppSync WebSocket (wss://…appsync-realtime-api…). */
export type Conn = 'live' | 'connecting' | 'offline' | 'local';

export interface BackendEvents {
  connection(state: Conn): void;
  message(chatId: string, msg: Msg): void;
  chat(chat: Chat): void;
  presence(peerId: string, seen: number): void;
  peerRead(chatId: string, at: number): void;
  status(chatId: string, msgId: string, status: MsgStatus): void;
  signal(s: Signal): void;
}

export type SignInResult = 'done' | 'confirm' | 'reset';

export interface Backend {
  mode: 'demo' | 'aws';
  currentUser(): Promise<Me | null>;
  signIn(email: string, password: string): Promise<SignInResult>;
  signUp(name: string, email: string, password: string): Promise<SignInResult>;
  confirmSignUp(email: string, code: string): Promise<void>;
  resendCode(email: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(email: string, code: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  loadChats(me: Me): Promise<{ chats: Chat[]; muted: string[] }>;
  /** Start realtime subscriptions + presence; returns a stop function. */
  start(me: Me, ev: BackendEvents): () => void;
  /** Persist a message (uploading attachments). Returns the stored message. */
  send(me: Me, chat: Chat, msg: Msg, onProgress: (p: number) => void): Promise<Msg>;
  /** Messages sent before `before` (ms), oldest first, and whether even older ones exist. */
  loadOlder(me: Me, chat: Chat, before: number): Promise<{ msgs: Msg[]; more: boolean }>;
  markRead(me: Me, chat: Chat, at: number): void;
  clear(me: Me, chat: Chat, at: number | undefined): Promise<void>;
  setMuted(me: Me, muted: string[]): void;
  searchPeople(me: Me, q: string): Promise<Person[]>;
  openChatWith(me: Me, p: Person): Promise<Chat>;
  /** Resolve an S3 key to a temporary URL. */
  url(key: string): Promise<string>;
  signal(me: Me, chat: Chat, s: Omit<Signal, 'chatId' | 'fromId'>): Promise<void>;
}
