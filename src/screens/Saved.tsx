import { Bookmark } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { EmptyState, PageHeader } from '@/components/ui';
import { posts } from '@/data/mock';

export function Saved() {
  const saved = posts.filter((p) => p.saved);

  return (
    <div>
      <PageHeader title="Saved" subtitle="Posts and verses you’ve kept" />
      {saved.length ? (
        saved.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        <EmptyState
          icon={<Bookmark size={30} />}
          title="Nothing saved yet"
          body="Tap the bookmark on any post or verse to keep it here for later."
        />
      )}
    </div>
  );
}
