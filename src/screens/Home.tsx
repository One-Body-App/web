import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Inbox, Search } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { FeedVideoCard } from '@/components/FeedVideoCard';
import { ArticleCard } from '@/components/ArticleCard';
import { PrayerCard } from '@/screens/PrayerWall';
import { ComposerPrompt, EmptyState } from '@/components/ui';
import { posts as mockPosts, type FeedType } from '@/data/mock';
import { endpoints, type ApiFeedType, type OBArticle, type OBFeedItem } from '@/api/endpoints';
import { MOCK_PRAYERS, prayerApi, type Prayer } from '@/api/prayer';
import {
  FeedItemTelemetryContext,
  trackFeedEvent,
  type TelemetryFeedType,
} from '@/telemetry/feedTelemetry';
/* sponsored ad injection */
import InlineAdCard from '@/components/ads/InlineAdCard';
import { fetchInlineAds, interleaveAds, isInlineAdEntry, type InlineAd } from '@/api/ads';
import './home.css';

type TopTab = 'feed' | 'read' | 'pray' | 'watch';
type SubType = 'forYou' | 'connected';

const SUB_API: Record<SubType, ApiFeedType> = { forYou: 'foryou', connected: 'connected' };
const OTHER_API: Record<Exclude<TopTab, 'feed'>, ApiFeedType> = {
  read: 'read',
  pray: 'pray',
  watch: 'watch',
};

/** A Home feed entry — a social post, a blog/news article, or a prayer. */
type FeedEntry = OBFeedItem | { kind: 'prayer'; prayer: Prayer };

/** Shown on the Read tab when the live RSS feed is unavailable (offline/CORS). */
const MOCK_ARTICLES: OBArticle[] = [
  {
    id: 'a1',
    title: 'Cultivating a deeper prayer life this season',
    summary: 'Practical rhythms for staying anchored in the Word when life gets loud and busy.',
    image: 'https://picsum.photos/seed/ob-article-prayer/900/600',
    link: 'https://www.example.com/',
    sourceName: 'One Body Reads',
    sourceAvatar: '/brand/avatar1.png',
    time: '3h',
  },
  {
    id: 'a2',
    title: 'How small groups are reshaping the modern church',
    summary: 'Communities are rediscovering the power of meeting together in homes and third spaces.',
    image: 'https://picsum.photos/seed/ob-article-community/900/600',
    link: 'https://www.example.com/',
    sourceName: 'Faith & Culture',
    sourceAvatar: '/brand/avatar2.png',
    time: '8h',
  },
];

function feedItemKey(item: FeedEntry): string {
  if (item.kind === 'article') return `a-${item.article.id}`;
  if (item.kind === 'prayer') return `pr-${item.prayer.id}`;
  if (item.kind === 'video') return `v-${item.video.id}`;
  return `p-${item.post.id}`;
}

function itemPostId(item: FeedEntry): string {
  if (item.kind === 'article') return item.article.id;
  if (item.kind === 'prayer') return item.prayer.id;
  if (item.kind === 'video') return item.video.id;
  return item.post.id;
}

function itemPostType(item: FeedEntry): string {
  if (item.kind === 'article') return 'rss';
  if (item.kind === 'prayer') return 'prayer';
  if (item.kind === 'video') return 'watch';
  return 'social';
}

/** Fetch one page for the active tab, normalized to the heterogeneous feed-entry shape. */
function fetchFeedPage(top: TopTab, sub: SubType, page: number, myId: string): Promise<FeedEntry[]> {
  if (top === 'read') {
    return endpoints
      .getReadFeed(page)
      .then((articles) => articles.map((article) => ({ kind: 'article' as const, article })));
  }
  // The Pray tab is the Prayer Wall feed — same `prayer` endpoint mobile uses.
  if (top === 'pray') {
    return prayerApi
      .list(page, myId)
      .then((prayers) => prayers.map((prayer) => ({ kind: 'prayer' as const, prayer })));
  }
  const type = top === 'feed' ? SUB_API[sub] : OTHER_API[top];
  return endpoints.getFeedItems(type, page, myId);
}

function mockForTab(top: TopTab, sub: SubType): FeedEntry[] {
  if (top === 'read') return MOCK_ARTICLES.map((article) => ({ kind: 'article', article }));
  if (top === 'pray') return MOCK_PRAYERS.map((prayer) => ({ kind: 'prayer', prayer }));
  const feedKey: FeedType = top === 'feed' ? sub : top;
  const entries: FeedEntry[] = [];
  for (const post of mockPosts) {
    for (const feed of post.feeds) {
      if (feed !== feedKey) continue;
      entries.push({ kind: 'post', post });
      break;
    }
  }
  return entries;
}

/** Search bar that replaces the "Home" title (desktop/tablet). Submits to Explore. */
function HomeSearch() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  return (
    <form
      className="home-search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        navigate(v ? `/explore?q=${encodeURIComponent(v)}` : '/explore');
      }}
    >
      <Search size={20} className="home-search__icon" />
      <input
        className="home-search__input"
        placeholder="Search One Body"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search One Body"
      />
    </form>
  );
}

/**
 * Wraps a feed item and reports view telemetry: impression (>=50% visible),
 * qualified view (visible >=2.5s), and dwell (time visible on exit).
 */
function TrackedFeedItem({
  feedType,
  postId,
  postType,
  rank,
  children,
}: {
  feedType: TelemetryFeedType;
  postId: string;
  postType: string;
  rank: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !postId) return;

    let seen = false;
    let qualified = false;
    let visibleSince: number | null = null;
    let qualifyTimer: ReturnType<typeof setTimeout> | null = null;
    const base = {
      feedType,
      postId,
      postType,
      contentType: postType,
      rankPosition: rank,
      surfaceTab: feedType,
    };

    const fireDwell = () => {
      if (visibleSince != null) {
        const durationMs = Date.now() - visibleSince;
        visibleSince = null;
        if (durationMs > 300) {
          trackFeedEvent({ ...base, eventType: 'dwell', canonicalEventName: 'post_dwell', durationMs });
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!seen) {
            seen = true;
            trackFeedEvent({ ...base, eventType: 'impression', canonicalEventName: 'post_impression' });
          }
          if (visibleSince == null) visibleSince = Date.now();
          if (!qualified && qualifyTimer == null) {
            qualifyTimer = setTimeout(() => {
              qualified = true;
              trackFeedEvent({
                ...base,
                eventType: 'qualified_view',
                canonicalEventName: 'post_view_qualified',
              });
            }, 2500);
          }
        } else {
          if (qualifyTimer != null) {
            clearTimeout(qualifyTimer);
            qualifyTimer = null;
          }
          fireDwell();
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (qualifyTimer != null) clearTimeout(qualifyTimer);
      fireDwell();
    };
  }, [feedType, postId, postType, rank]);

  return (
    <FeedTelemetryProvider feedType={feedType} postId={postId} postType={postType} rank={rank}>
      <div ref={ref}>{children}</div>
    </FeedTelemetryProvider>
  );
}

function FeedTelemetryProvider({
  feedType,
  postId,
  postType,
  rank,
  children,
}: {
  feedType: TelemetryFeedType;
  postId: string;
  postType: string;
  rank: number;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ feedType, postId, postType, rankPosition: rank }),
    [feedType, postId, postType, rank],
  );
  return <FeedItemTelemetryContext.Provider value={value}>{children}</FeedItemTelemetryContext.Provider>;
}

function FeedSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ padding: 'var(--sp-16)', marginBottom: 'var(--sp-16)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-12)', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 46, height: 46, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '40%', height: 12, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '25%', height: 10 }} />
            </div>
          </div>
          <div className="skeleton" style={{ width: '100%', height: 12, marginTop: 16 }} />
          <div className="skeleton" style={{ width: '80%', height: 12, marginTop: 8 }} />
          <div className="skeleton" style={{ width: '100%', height: 200, marginTop: 14, borderRadius: 12 }} />
        </div>
      ))}
    </>
  );
}

export function Home() {
  const [top, setTop] = useState<TopTab>('feed');
  const [sub, setSub] = useState<SubType>('forYou');
  const [meId, setMeId] = useState<string | null>(null);

  const [items, setItems] = useState<FeedEntry[]>([]);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [end, setEnd] = useState(false);
  const [fallback, setFallback] = useState(false);
  /* sponsored ad injection */
  const [inlineAds, setInlineAds] = useState<InlineAd[]>([]);

  const telemetryFeed: TelemetryFeedType =
    top === 'feed' ? (sub === 'connected' ? 'connected' : 'foryou') : top;
  const reloadFeed = () => setReloadKey((k) => k + 1);

  // Resolve the signed-in user's id once (used to highlight my own reactions).
  useEffect(() => {
    let active = true;
    endpoints
      .getMyProfileMapped()
      .then((me) => active && setMeId(me?.id ?? ''))
      .catch(() => active && setMeId(''));
    return () => {
      active = false;
    };
  }, []);

  /* sponsored ad injection: fetch inline ads once on mount */
  useEffect(() => {
    let active = true;
    fetchInlineAds().then((ads) => {
      if (active) setInlineAds(ads);
    });
    return () => {
      active = false;
    };
  }, []);

  // Reset the list when the active feed changes (or a reload is requested).
  useEffect(() => {
    setItems([]);
    setPage(1);
    setEnd(false);
    setLoading(true);
  }, [top, sub, reloadKey]);

  // Fetch the current page (waits until the profile lookup settles).
  useEffect(() => {
    if (meId === null) return;
    let active = true;
    const isFirstPage = page === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    fetchFeedPage(top, sub, page, meId)
      .then((batch) => {
        if (!active) return;
        setFallback(false);
        setEnd(batch.length === 0);
        setItems((prev) => {
          if (isFirstPage) return batch;
          const seen = new Set(prev.map(feedItemKey));
          return [...prev, ...batch.filter((b) => !seen.has(feedItemKey(b)))];
        });
      })
      .catch(() => {
        if (!active) return;
        if (isFirstPage) {
          setItems(mockForTab(top, sub));
          setFallback(true);
        }
        setEnd(true);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      active = false;
    };
  }, [top, sub, page, meId, reloadKey]);

  // Infinite scroll: load the next page as the sentinel nears the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || end || fallback) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, fallback, loading, loadingMore]);

  return (
    <div>
      <HomeSearch />

      <div style={{ marginBottom: 'var(--sp-16)' }}>
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={top === 'feed' ? 'true' : 'false'}
            className={`segmented__item${top === 'feed' ? ' is-active' : ''}`}
            onClick={() =>
              top === 'feed'
                ? setSub((s) => (s === 'forYou' ? 'connected' : 'forYou'))
                : setTop('feed')
            }
            title={top === 'feed' ? 'Tap to switch For You / Connected' : undefined}
          >
            {top === 'feed' ? (sub === 'connected' ? 'Connected' : 'For You') : 'Feed'}
            {top === 'feed' ? (
              <ChevronDown size={13} style={{ marginLeft: 3, marginBottom: -2 }} aria-hidden />
            ) : null}
          </button>
          {(['read', 'pray', 'watch'] as const).map((t) => (
            <button
              type="button"
              key={t}
              role="tab"
              aria-selected={top === t ? 'true' : 'false'}
              className={`segmented__item${top === t ? ' is-active' : ''}`}
              onClick={() => setTop(t)}
            >
              {t === 'read' ? 'Read' : t === 'pray' ? 'Pray' : 'Watch'}
            </button>
          ))}
        </div>
      </div>

      {top === 'feed' ? <ComposerPrompt /> : null}

      {loading && items.length === 0 ? (
        <FeedSkeleton />
      ) : items.length ? (
        <>
          {/* sponsored ad injection: interleave an ad after every 6th feed item */}
          {interleaveAds(items, inlineAds, 6).map((entry, i) =>
            isInlineAdEntry(entry) ? (
              <InlineAdCard key={`ad-${entry.adKey}`} ad={entry.ad} />
            ) : (
              <TrackedFeedItem
                key={feedItemKey(entry)}
                feedType={telemetryFeed}
                postId={itemPostId(entry)}
                postType={itemPostType(entry)}
                rank={i}
              >
                {entry.kind === 'article' ? (
                  <ArticleCard article={entry.article} />
                ) : entry.kind === 'prayer' ? (
                  <PrayerCard prayer={entry.prayer} meId={meId ?? ''} onChanged={reloadFeed} />
                ) : entry.kind === 'video' ? (
                  <FeedVideoCard video={entry.video} />
                ) : (
                  <PostCard post={entry.post} />
                )}
              </TrackedFeedItem>
            )
          )}
          {!end && !fallback ? <div ref={sentinelRef} aria-hidden style={{ height: 1 }} /> : null}
          {loadingMore ? (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--sp-16)',
                color: 'var(--muted)',
                fontSize: 'var(--fs-2)',
              }}
            >
              Loading more…
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={<Inbox size={30} />}
          title="Nothing here yet"
          body={
            top === 'pray'
              ? 'No prayer requests yet — be the first to share one on the Prayer Wall.'
              : top === 'feed' && sub === 'connected'
                ? 'Follow creators and churches to fill your Connected feed.'
                : 'Switch tabs or follow more of the Body to discover posts.'
          }
        />
      )}
    </div>
  );
}
