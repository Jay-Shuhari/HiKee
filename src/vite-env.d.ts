/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_HIKEE_MODE?: 'demo' | 'aws';
  readonly VITE_ICE_SERVERS?: string;
}
