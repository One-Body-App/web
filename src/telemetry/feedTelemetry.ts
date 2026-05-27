import { createContext, useContext } from 'react';
import { api } from '@/api/client';

/**
 * Web feed telemetry — mirrors the mobile app's contract: queue events locally,
 * batch them, and POST to `user/feed-telemetry/batch`. These events power the
 * trending-tags scoring on the server, so the surface/feed metadata matters.
 *
 * Best-effort: failures are dropped (no retry storms / CORS spam). The Clerk
 * bearer is attached automatically by the api client.
 */
export type TelemetryFeedType = 'foryou' | 'connected' | 'read' | 'pray' | 'watch';

export interface FeedTelemetryEvent {
  eventType: string; // 'impression' | 'qualified_view' | 'dwell' | 'reaction' | ...
  feedType: TelemetryFeedType;
  postId: string;
  canonicalEventName?: string; // 'post_impression' | 'post_view_qualified' | ...
  postType?: string; // 'social' | 'rss' | 'prayer' | 'watch'
  contentType?: string;
  tags?: string[];
  durationMs?: number;
  rankPosition?: number;
  surface?: string;
  surfaceTab?: string;
  sessionId?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

const SESSION_ID = `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const MAX_BATCH = 50;
const MAX_QUEUE = 500;
const FLUSH_MS = 4000;

let queue: FeedTelemetryEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function scheduleFlush() {
  if (timer != null) return;
  timer = setTimeout(() => {
    timer = null;
    void flushFeedTelemetry();
  }, FLUSH_MS);
}

/** Queue a feed telemetry event (validated minimally; flushed on an interval). */
export function trackFeedEvent(event: FeedTelemetryEvent): void {
  if (!event.postId || !event.feedType || !event.eventType) return;
  queue.push({ sessionId: SESSION_ID, occurredAt: new Date().toISOString(), surface: 'web', ...event });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  scheduleFlush();
}

/** Send queued events in batches. Re-queues the remainder on success. */
export async function flushFeedTelemetry(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);
  try {
    await api.post('user/feed-telemetry/batch', { events: batch });
  } catch {
    // Best-effort: drop the batch on failure.
  } finally {
    flushing = false;
    if (queue.length > 0) scheduleFlush();
  }
}

// Flush when the tab is hidden / unloaded so we don't lose the last few seconds.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushFeedTelemetry();
  });
  window.addEventListener('pagehide', () => void flushFeedTelemetry());
}

/* --------------------- Per-item interaction telemetry --------------------- */
export interface FeedItemTelemetry {
  feedType: TelemetryFeedType;
  postId: string;
  postType: string;
  rankPosition: number;
}

export const FeedItemTelemetryContext = createContext<FeedItemTelemetry | null>(null);

/**
 * Returns a tracker bound to the nearest feed item (via context). Calling it
 * outside a feed item is a no-op, so cards can use it safely anywhere.
 */
export function useFeedTelemetry() {
  const ctx = useContext(FeedItemTelemetryContext);
  return (eventType: string, canonicalEventName: string, metadata?: Record<string, unknown>) => {
    if (!ctx) return;
    trackFeedEvent({
      feedType: ctx.feedType,
      postId: ctx.postId,
      postType: ctx.postType,
      contentType: ctx.postType,
      rankPosition: ctx.rankPosition,
      surfaceTab: ctx.feedType,
      eventType,
      canonicalEventName,
      metadata,
    });
  };
}
