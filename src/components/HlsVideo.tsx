import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HlsVideoProps {
  src: string;
  poster?: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  onVideoEvent?: (
    eventType: string,
    canonicalEventName: string,
    metadata?: Record<string, unknown>,
  ) => void;
}

/**
 * Plays an HLS (.m3u8) stream — e.g. Mux. Safari/iOS play HLS natively; other
 * browsers use hls.js (Media Source Extensions). Falls back to a direct src.
 */
export function HlsVideo({
  src,
  poster,
  className,
  controls = true,
  autoPlay = false,
  loop = false,
  muted = false,
  onVideoEvent,
}: HlsVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;

    // Native HLS (Safari / iOS).
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      const onManifestParsed = () => video.play().catch(() => {});
      if (autoPlay) {
        hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      }
      return () => {
        if (autoPlay) hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
        hls.destroy();
      };
    }

    // Last resort.
    video.src = src;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, [src, autoPlay]);

  // Playback telemetry: play / pause / progress milestones (25/50/75) / complete.
  useEffect(() => {
    const video = ref.current;
    if (!video || !onVideoEvent) return;
    const milestones = new Set<number>();
    const onPlay = () => onVideoEvent('video_play', 'post_video_start');
    const onPause = () => {
      if (!video.ended) onVideoEvent('video_pause', 'post_video_pause');
    };
    const onEnded = () => onVideoEvent('video_complete', 'post_video_complete', { completionPct: 100 });
    const onTime = () => {
      if (!video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      for (const m of [25, 50, 75]) {
        if (pct >= m && !milestones.has(m)) {
          milestones.add(m);
          onVideoEvent('video_progress', 'post_video_progress', { completionPct: m });
        }
      }
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTime);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTime);
    };
  }, [onVideoEvent, src]);

  return (
    <video
      ref={ref}
      poster={poster}
      className={className}
      controls={controls}
      loop={loop}
      muted={muted}
      playsInline
      preload="metadata"
      aria-label="Video player"
    />
  );
}
