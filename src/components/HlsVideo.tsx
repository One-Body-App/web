import { useCallback, useRef } from 'react';

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
  const cleanupRef = useRef<(() => void) | null>(null);

  const videoRef = useCallback((video: HTMLVideoElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!video || !src) return;
    let disposed = false;
    let streamCleanup: (() => void) | undefined;
    const milestones = new Set<number>();
    const onPlay = () => onVideoEvent?.('video_play', 'post_video_start');
    const onPause = () => {
      if (!video.ended) onVideoEvent?.('video_pause', 'post_video_pause');
    };
    const onEnded = () => onVideoEvent?.('video_complete', 'post_video_complete', { completionPct: 100 });
    const onTime = () => {
      if (!video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      for (const milestone of [25, 50, 75]) {
        if (pct >= milestone && !milestones.has(milestone)) {
          milestones.add(milestone);
          onVideoEvent?.('video_progress', 'post_video_progress', { completionPct: milestone });
        }
      }
    };

    if (onVideoEvent) {
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('ended', onEnded);
      video.addEventListener('timeupdate', onTime);
    }

    // Native HLS (Safari / iOS).
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
      streamCleanup = () => {
        video.removeAttribute('src');
        video.load();
      };
    } else {
      const currentVideo = video as HTMLVideoElement;
      async function loadHls() {
        let Hls: typeof import('hls.js/light').default | null = null;
        try {
          Hls = (await import('hls.js/light')).default;
        } catch {
          Hls = null;
        }
        if (disposed) return;

        if (Hls?.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(src);
          hls.attachMedia(currentVideo);
          const onManifestParsed = () => currentVideo.play().catch(() => {});
          if (autoPlay) {
            hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
          }
          streamCleanup = () => {
            if (autoPlay) hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hls.destroy();
          };
          return;
        }

        // Last resort.
        currentVideo.src = src;
        streamCleanup = () => {
          currentVideo.removeAttribute('src');
          currentVideo.load();
        };
      }
      void loadHls();
    }

    cleanupRef.current = () => {
      disposed = true;
      streamCleanup?.();
      if (onVideoEvent) {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('timeupdate', onTime);
      }
    };
  }, [src, autoPlay, onVideoEvent]);

  return (
    <video
      ref={videoRef}
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
