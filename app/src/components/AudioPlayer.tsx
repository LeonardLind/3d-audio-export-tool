import type { RefObject } from "react";

interface AudioPlayerProps {
  src: string;
  // Owned by App and shared with the scrolling panels so they can read currentTime at
  // 60fps (rAF) for smooth scroll, independent of the ~4/sec onTimeUpdate state pump.
  audioRef: RefObject<HTMLAudioElement | null>;
  onTimeChange: (currentTime: number) => void;
}

export function AudioPlayer({ src, audioRef, onTimeChange }: AudioPlayerProps) {
  const reportTime = () => {
    if (audioRef.current) onTimeChange(audioRef.current.currentTime);
  };

  return (
    <audio
      ref={audioRef}
      src={src}
      controls
      onTimeUpdate={reportTime}
      onSeeking={reportTime}
      onSeeked={reportTime}
      className="audio-player"
    />
  );
}
