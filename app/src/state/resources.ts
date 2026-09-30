import { createContext } from 'react';
import type { RefObject } from 'react';
import type { PlayHandle } from '../audio/types.ts';

export interface Resources {
  audioRef: RefObject<HTMLAudioElement | null>;
  engineRef: RefObject<PlayHandle | null>;
  startUpload(file: File): void;
  setStartUpload(handler: (file: File) => void): void;
}

export const ResourcesContext = createContext<Resources | null>(null);
