import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { ArticleCard } from '@/components/ArticleCard';
import { ComposerPrompt, EmptyState, PageHeader, Segmented } from '@/components/ui';
import { FEED_TABS, posts as mockPosts, type FeedType, type OBPost } from '@/data/mock';
import { endpoints, type ApiFeedType, type OBArticle } from '@/api/endpoints';
import { useApiQuery } from '@/api/useApi';

const FEED_TYPE_MAP: Record<FeedType, ApiFeedType> = {
  forYou: 'foryou',
  connected: 'connected',
  read: 'read',
  pray: 'pray',
  watch: 'watch',
};

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

type FeedItem = { kind: 'post'; post: OBPost } | { kind: 'article'; article: OBArticle };

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
  const [feed, setFeed] = useState<FeedType>('forYou');
  const isRead = feed === 'read';

  const mockForFeed = useMemo<FeedItem[]>(
    () =>
      isRead
        ? MOCK_ARTICLES.map((article) => ({ kind: 'article', article }))
        : mockPosts.filter((p) => p.feeds.includes(feed)).map((post) => ({ kind: 'post', post })),
    [feed, isRead],
  );

  const { data, loading } = useApiQuery<FeedItem[]>(
    () =>
      isRead
        ? endpoints
            .getReadFeed(1)
            .then((items) => items.map((article) => ({ kind: 'article' as const, article })))
        : endpoints
            .getFeed(FEED_TYPE_MAP[feed], 1)
            .then((items) => items.map((post) => ({ kind: 'post' as const, post }))),
    { fallback: mockForFeed, deps: [feed] },
  );

  const list = data ?? mockForFeed;

  return (
    <div>
      <PageHeader title="Home" />
      <div style={{ marginBottom: 'var(--sp-16)' }}>
        <Segmented value={feed} onChange={setFeed} options={FEED_TABS} />
      </div>

      {!isRead ? <ComposerPrompt /> : null}

      {loading && !data ? (
        <FeedSkeleton />
      ) : list.length ? (
        list.map((item) =>
          item.kind === 'article' ? (
            <ArticleCard key={item.article.id} article={item.article} />
          ) : (
            <PostCard key={item.post.id} post={item.post} />
          ),
        )
      ) : (
        <EmptyState
          icon={<Inbox size={30} />}
          title="Nothing here yet"
          body="Follow creators and churches, or switch tabs to discover more of the Body."
        />
      )}
    </div>
  );
}
