import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { PlayHandle } from '../audio/types.ts';
import { ResourcesContext } from './resources.ts';
import type { Resources } from './resources.ts';

export function ResourcesProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<PlayHandle>(null);
  const uploadHandler = useRef<(file: File) => void>(() => {});
  const value = useMemo<Resources>(() => ({ audioRef, engineRef,
    startUpload: (file) => uploadHandler.current(file),
    setStartUpload: (handler) => { uploadHandler.current = handler; },
  }), []);
  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>;
}
