import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { ComposerPrompt, EmptyState, PageHeader, Segmented } from '@/components/ui';
import { FEED_TABS, posts as mockPosts, type FeedType } from '@/data/mock';
import { endpoints, type ApiFeedType } from '@/api/endpoints';
import { useApiQuery } from '@/api/useApi';

const FEED_TYPE_MAP: Record<FeedType, ApiFeedType> = {
  forYou: 'foryou',
  connected: 'connected',
  read: 'read',
  pray: 'pray',
  watch: 'watch',
};

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

  const mockForFeed = useMemo(() => mockPosts.filter((p) => p.feeds.includes(feed)), [feed]);

  const { data, loading } = useApiQuery(() => endpoints.getFeed(FEED_TYPE_MAP[feed], 1), {
    fallback: mockForFeed,
    deps: [feed],
  });

  const list = data ?? mockForFeed;

  return (
    <div>
      <PageHeader title="Home" />
      <div style={{ marginBottom: 'var(--sp-16)' }}>
        <Segmented value={feed} onChange={setFeed} options={FEED_TABS} />
      </div>

      <ComposerPrompt />

      {loading && !data ? (
        <FeedSkeleton />
      ) : list.length ? (
        list.map((post) => <PostCard key={post.id} post={post} />)
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
