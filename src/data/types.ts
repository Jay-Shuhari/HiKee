export type AttType = 'image' | 'video' | 'audio' | 'doc';
export type Cell = string | number;

export interface Preview {
  kind: 'page' | 'sheet' | 'slides' | 'file';
  title?: string;
  pages?: number;
  paras?: string[];
  sheet?: string;
  sheets?: number;
  rows?: Cell[][];
  slides?: { title: string; paras: string[] }[];
  none?: boolean;
}

/** An attachment. Local-only fields (file, src blob urls) never leave the device. */
export interface Att {
  type: AttType;
  name: string;
  size?: number;
  /** Displayable url (data:, blob:, or resolved S3 url). */
  src?: string;
  /** S3 object path of the original file. */
  key?: string;
  w?: number;
  h?: number;
  dur?: number;
  peaks?: number[];
  poster?: string;
  posterKey?: string;
  pv?: Preview;
  thumb?: string;
  thumbKey?: string;
  pageImgs?: string[];
  pageKeys?: string[];
  excerpt?: string;
  pages?: number;
  /** Sample PDF that can be generated on download. */
  pdf?: boolean;
  mime?: string;
  file?: Blob;
}

export type MsgStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Msg {
  id: string;
  from: 'me' | 'them';
  t: number;
  text: string;
  atts: Att[];
  status: MsgStatus;
  /** Upload progress 0..1 while sending. */
  progress?: number;
}

export interface Chat {
  id: string;
  name: string;
  color: string;
  online: boolean;
  seen?: number;
  unread: number;
  msgs: Msg[];
  peerId?: string;
  members?: string[];
  /** Sort time for chats with no messages yet. */
  at?: number;
  /** When I last cleared this chat; earlier messages are hidden for me. */
  clearedAt?: number;
  /** When the other person last read the chat. */
  peerReadAt?: number;
  /** Older messages exist on the server that haven't been loaded yet. */
  hasMore?: boolean;
}

export interface Me {
  id: string;
  name: string;
  email?: string;
  color: string;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  color: string;
}

export type NavKey = 'pictures' | 'videos' | 'documents' | 'audio' | 'media';
export type Page = 'home' | 'chat' | 'media';
export type ThemePref = 'system' | 'light' | 'dark';
