import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { CloudRecording } from '../data/types.ts';
import { dispatch } from '../state/store.ts';

export function useKeyboard({ recording, audioRef, allowUpload = false }: {
  recording: CloudRecording | null; audioRef: RefObject<HTMLAudioElement | null>; allowUpload?: boolean;
}): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(event.target.tagName))) return;
      if (event.key === 'Escape') { dispatch({ type: 'SELECT_CLEAR' }); return; }
      if (event.key.toLowerCase() === 'f') { dispatch({ type: 'FIT_VIEW' }); return; }
      const axis = ({ x: 1, y: 2, z: 4 } as const)[event.key.toLowerCase() as 'x' | 'y' | 'z'];
      if (axis) {
        dispatch({ type: 'TOGGLE_AXIS', axis, startedAt: performance.now(), reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
        return;
      }
      if (event.key === ' ' && recording && (recording.origin !== 'upload' || allowUpload)) {
        event.preventDefault();
        const audio = audioRef.current;
        if (audio) { if (audio.paused) void audio.play().catch(() => audio.dispatchEvent(new Event('playbackerror'))); else audio.pause(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recording, audioRef, allowUpload]);
}
