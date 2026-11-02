/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_VOICE_MODE?: 'mock' | 'elevenlabs';
  readonly VITE_WORKER_BASE_URL?: string;
}
