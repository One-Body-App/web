import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
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

const ariaSelected = (selected: boolean) =>
  selected ? ({ 'aria-selected': 'true' } as const) : ({ 'aria-selected': 'false' } as const);

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

type HomeSnapshot = {
  top: TopTab;
  sub: SubType;
  meId: string | null;
  items: FeedEntry[];
  page: number;
  loading: boolean;
  loadingMore: boolean;
  end: boolean;
  fallback: boolean;
  inlineAds: InlineAd[];
};

function createHomeStore() {
  let started = false;
  let requestId = 0;
  let snapshot: HomeSnapshot = {
    top: 'feed',
    sub: 'forYou',
    meId: null,
    items: [],
    page: 1,
    loading: true,
    loadingMore: false,
    end: false,
    fallback: false,
    inlineAds: [],
  };
  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const update = (patch: Partial<HomeSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    emit();
  };

  const loadFeed = (
    page: number,
    top: TopTab,
    sub: SubType,
    meId: string,
    activeRequestId: number,
  ) => {
    const isFirstPage = page === 1;
    update({
      page,
      loading: isFirstPage,
      loadingMore: !isFirstPage,
      ...(isFirstPage ? { items: [], end: false, fallback: false } : null),
    });

    fetchFeedPage(top, sub, page, meId)
      .then((batch) => {
        if (activeRequestId !== requestId) return;
        const seen = new Set(snapshot.items.map(feedItemKey));
        update({
          fallback: false,
          end: batch.length === 0,
          items: isFirstPage
            ? batch
            : [...snapshot.items, ...batch.filter((item) => !seen.has(feedItemKey(item)))],
          loading: false,
          loadingMore: false,
        });
      })
      .catch(() => {
        if (activeRequestId !== requestId) return;
        update({
          items: isFirstPage ? mockForTab(top, sub) : snapshot.items,
          fallback: isFirstPage || snapshot.fallback,
          end: true,
          loading: false,
          loadingMore: false,
        });
      });
  };

  const resetAndLoad = (top: TopTab, sub: SubType) => {
    requestId += 1;
    update({
      top,
      sub,
      items: [],
      page: 1,
      loading: true,
      loadingMore: false,
      end: false,
      fallback: false,
    });
    if (snapshot.meId !== null) {
      loadFeed(1, top, sub, snapshot.meId, requestId);
    }
  };

  const start = () => {
    if (started) return;
    started = true;

    endpoints
      .getMyProfileMapped()
      .then((me) => {
        update({ meId: me?.id ?? '' });
        resetAndLoad(snapshot.top, snapshot.sub);
      })
      .catch(() => {
        update({ meId: '' });
        resetAndLoad(snapshot.top, snapshot.sub);
      });

    fetchInlineAds()
      .then((ads) => update({ inlineAds: ads }))
      .catch(() => update({ inlineAds: [] }));
  };

  return {
    getSnapshot: () => snapshot,
    loadNextPage: () => {
      if (
        snapshot.meId === null ||
        snapshot.loading ||
        snapshot.loadingMore ||
        snapshot.end ||
        snapshot.fallback
      ) {
        return;
      }
      loadFeed(snapshot.page + 1, snapshot.top, snapshot.sub, snapshot.meId, requestId);
    },
    reloadFeed: () => resetAndLoad(snapshot.top, snapshot.sub),
    setTop: (top: TopTab) => {
      if (top === snapshot.top) return;
      resetAndLoad(top, snapshot.sub);
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
      };
    },
    toggleFeedSub: () => {
      if (snapshot.top !== 'feed') {
        resetAndLoad('feed', snapshot.sub);
        return;
      }
      resetAndLoad('feed', snapshot.sub === 'forYou' ? 'connected' : 'forYou');
    },
  };
}

const homeStore = createHomeStore();

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
  const cleanupRef = useRef<(() => void) | null>(null);

  const setTrackedNode = useCallback((node: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!node || !postId) return;
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
    observer.observe(node);

    cleanupRef.current = () => {
      observer.disconnect();
      if (qualifyTimer != null) clearTimeout(qualifyTimer);
      fireDwell();
    };
  }, [feedType, postId, postType, rank]);

  return (
    <FeedTelemetryProvider feedType={feedType} postId={postId} postType={postType} rank={rank}>
      <div ref={setTrackedNode}>{children}</div>
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
        <div key={i} className="card home-skeleton-card">
          <div className="home-skeleton-card__header">
            <div className="skeleton home-skeleton-card__avatar" />
            <div className="home-skeleton-card__meta">
              <div className="skeleton home-skeleton-card__title" />
              <div className="skeleton home-skeleton-card__subtitle" />
            </div>
          </div>
          <div className="skeleton home-skeleton-card__line" />
          <div className="skeleton home-skeleton-card__line home-skeleton-card__line--short" />
          <div className="skeleton home-skeleton-card__media" />
        </div>
      ))}
    </>
  );
}

export function Home() {
  const { end, fallback, inlineAds, items, loading, loadingMore, meId, sub, top } =
    useSyncExternalStore(homeStore.subscribe, homeStore.getSnapshot, homeStore.getSnapshot);

  const telemetryFeed: TelemetryFeedType =
    top === 'feed' ? (sub === 'connected' ? 'connected' : 'foryou') : top;

  // Infinite scroll: load the next page as the sentinel nears the viewport.
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
  const setSentinelNode = useCallback((node: HTMLDivElement | null) => {
    sentinelObserverRef.current?.disconnect();
    sentinelObserverRef.current = null;
    if (!node || end || fallback) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) {
          homeStore.loadNextPage();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    sentinelObserverRef.current = observer;
  }, [end, fallback, loading, loadingMore]);

  return (
    <div>
      <HomeSearch />

      <div className="home-tabs">
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            {...ariaSelected(top === 'feed')}
            className={`segmented__item${top === 'feed' ? ' is-active' : ''}`}
            onClick={() =>
              top === 'feed'
                ? homeStore.toggleFeedSub()
                : homeStore.setTop('feed')
            }
            title={top === 'feed' ? 'Tap to switch For You / Connected' : undefined}
          >
            {top === 'feed' ? (sub === 'connected' ? 'Connected' : 'For You') : 'Feed'}
            {top === 'feed' ? (
              <ChevronDown size={13} className="home-tabs__chevron" aria-hidden />
            ) : null}
          </button>
          {(['read', 'pray', 'watch'] as const).map((t) => (
            <button
              type="button"
              key={t}
              role="tab"
              {...ariaSelected(top === t)}
              className={`segmented__item${top === t ? ' is-active' : ''}`}
              onClick={() => homeStore.setTop(t)}
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
                  <PrayerCard prayer={entry.prayer} meId={meId ?? ''} onChanged={homeStore.reloadFeed} />
                ) : entry.kind === 'video' ? (
                  <FeedVideoCard video={entry.video} />
                ) : (
                  <PostCard post={entry.post} />
                )}
              </TrackedFeedItem>
            )
          )}
          {!end && !fallback ? <div ref={setSentinelNode} className="home-sentinel" aria-hidden /> : null}
          {loadingMore ? (
            <div className="home-loading-more">
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
                ? 'Connect with creators and churches to fill your Connected feed.'
                : 'Switch tabs or connect with more of the Body to discover posts.'
          }
        />
      )}
    </div>
  );
}
