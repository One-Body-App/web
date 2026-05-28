import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  FileText,
  HeartHandshake,
  MapPin,
  Newspaper,
  Play,
  Search,
  Users,
} from 'lucide-react';
import { ArticleCard } from '@/components/ArticleCard';
import { Avatar } from '@/components/Avatar';
import { FeedVideoCard } from '@/components/FeedVideoCard';
import { PostCard } from '@/components/PostCard';
import { EmptyState, PageHeader, SectionHeader, Segmented } from '@/components/ui';
import { connectApi, type ConnectEvent, type ConnectJob } from '@/api/connect';
import type { OBUser } from '@/data/mock';
import { endpoints, type OBArticle, type OBFeedItem, type OBSearchItem } from '@/api/endpoints';
import { type WatchVideo, watchApi } from '@/api/watch';
import { PrayerCard } from './PrayerWall';
import { useApiMutation, useApiQuery } from '@/api/useApi';
import './Explore.css';

type SearchFilter = 'top' | 'profiles' | 'latest' | 'watch';
type SearchRow =
  | { kind: 'user'; user: OBUser; id: string }
  | { kind: 'content'; item: OBSearchItem; id: string };

const SEARCH_FILTERS: { key: SearchFilter; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'latest', label: 'Latest' },
  { key: 'profiles', label: 'Profiles' },
  { key: 'watch', label: 'Watch' },
];

const EMPTY_USERS: OBUser[] = [];
const EMPTY_SEARCH_ITEMS: OBSearchItem[] = [];
const EMPTY_EVENTS: ConnectEvent[] = [];
const EMPTY_JOBS: ConnectJob[] = [];
const EMPTY_FEED_ITEMS: OBFeedItem[] = [];
const EMPTY_VIDEOS: WatchVideo[] = [];
const noop = () => {};

function interleaveSearchRows(users: OBUser[], content: OBSearchItem[]): SearchRow[] {
  const rows: SearchRow[] = [];
  const max = Math.max(users.length, content.length);
  for (let index = 0; index < max; index += 1) {
    const user = users[index];
    const item = content[index];
    if (user) rows.push({ kind: 'user', user, id: `user-${user.id}` });
    if (item) rows.push({ kind: 'content', item, id: getSearchItemId(item, index) });
  }
  return rows;
}

function getSearchItemId(item: OBSearchItem, index: number) {
  if (item.kind === 'post') return `post-${item.post.id}`;
  if (item.kind === 'article') return `article-${item.article.id}`;
  if (item.kind === 'video') return `video-${item.video.id}`;
  return `prayer-${item.prayer.id}-${index}`;
}

function SearchResultRow({ row }: { row: SearchRow }) {
  if (row.kind === 'user') return <UserRow user={row.user} />;
  const { item } = row;
  if (item.kind === 'post') return <PostCard post={item.post} />;
  if (item.kind === 'article') return <ArticleCard article={item.article} />;
  if (item.kind === 'video') return <FeedVideoCard video={item.video} />;
  return <PrayerCard prayer={item.prayer} meId="" onChanged={noop} />;
}

function isUpcoming(event: ConnectEvent): boolean {
  if (!event.startDate) return true;
  const time = new Date(event.startDate).getTime();
  if (Number.isNaN(time)) return true;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return time >= startOfToday.getTime();
}

function byEventDate(left: ConnectEvent, right: ConnectEvent) {
  const leftTime = left.startDate ? new Date(left.startDate).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.startDate ? new Date(right.startDate).getTime() : Number.MAX_SAFE_INTEGER;
  return (
    (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime) -
    (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime)
  );
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function ExploreSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="explore-section">
      <SectionHeader title={title} />
      <div className="explore-section__rows">{children}</div>
    </section>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="explore-empty-row">{label}</div>;
}

function EventRow({ event }: { event: ConnectEvent }) {
  return (
    <Link to={`/connect/events/${event.id}`} className="explore-row">
      <span className="explore-row__icon explore-row__icon--event">
        <CalendarDays size={19} />
      </span>
      <span className="explore-row__body">
        <strong>{event.title}</strong>
        <span>{event.dateLabel || 'Date TBA'}</span>
        <small>
          <MapPin size={13} /> {event.locationLabel}
        </small>
      </span>
      {event.attendees > 0 ? (
        <span className="explore-row__stat">
          <Users size={13} /> {formatCount(event.attendees)}
        </span>
      ) : null}
    </Link>
  );
}

function JobRow({ job }: { job: ConnectJob }) {
  return (
    <Link to={`/connect/serve/${job.id}`} className="explore-row">
      <span className="explore-row__icon explore-row__icon--serve">
        <HeartHandshake size={19} />
      </span>
      <span className="explore-row__body">
        <strong>{job.title}</strong>
        <span>{job.organizationName ?? 'One Body'}</span>
        <small>
          <MapPin size={13} /> {job.locationLabel}
        </small>
      </span>
      {job.opportunityType ? <span className="explore-row__chip">{job.opportunityType}</span> : null}
    </Link>
  );
}

function VideoRow({ video }: { video: WatchVideo }) {
  return (
    <Link to="/watch" className="explore-row explore-row--media">
      <span className="explore-row__thumb">
        <img src={video.thumbnail} alt="" loading="lazy" />
        <Play size={17} fill="currentColor" />
      </span>
      <span className="explore-row__body">
        <strong>{video.title || video.caption || video.authorName}</strong>
        <span>{video.authorName}</span>
        <small>
          {video.aspectRatio < 1 ? 'Short' : 'Video'} · {video.time || 'Recent'}
        </small>
      </span>
    </Link>
  );
}

function SocialRow({ post }: { post: OBFeedItem & { kind: 'post' } }) {
  const totalReactions = post.post.reactions.love + post.post.reactions.pray + post.post.reactions.rejoice;
  return (
    <Link to={`/post/social/${post.post.id}`} state={{ post: post.post }} className="explore-row">
      <Avatar
        src={post.post.author.avatar}
        alt={post.post.author.name}
        size={42}
        verified={post.post.author.verified}
      />
      <span className="explore-row__body">
        <strong>{post.post.author.name}</strong>
        <span>{post.post.body || 'Social post'}</span>
        <small>
          {post.post.createdAt}
          {totalReactions > 0 ? ` · ${formatCount(totalReactions)} reactions` : ''}
        </small>
      </span>
    </Link>
  );
}

function ArticleRow({ article }: { article: OBArticle }) {
  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer" className="explore-row">
      <span className="explore-row__icon explore-row__icon--article">
        <Newspaper size={19} />
      </span>
      <span className="explore-row__body">
        <strong>{article.title}</strong>
        <span>{article.sourceName}</span>
        {article.time ? <small>{article.time}</small> : null}
      </span>
    </a>
  );
}

function FollowButton({ userId }: { userId: string }) {
  const [following, setFollowing] = useState(false);
  const follow = useApiMutation((id: string) => endpoints.followUser(id));
  const unfollow = useApiMutation((id: string) => endpoints.unfollowUser(id));

  function toggle() {
    const next = !following;
    setFollowing(next);
    (next ? follow.mutate(userId) : unfollow.mutate(userId));
  }

  return (
    <button
      type="button"
      className={`btn btn--sm ${following ? 'btn--outline' : 'btn--accent'}`}
      onClick={toggle}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

function UserRow({ user }: { user: OBUser }) {
  return (
    <div className="discover-row card">
      <Avatar src={user.avatar} alt={user.name} size={52} verified={user.verified} />
      <div className="discover-row__meta">
        <strong>{user.name}</strong>
        <span className="discover-row__handle">
          @{user.username}
          {user.kind ? (
            <>
              {' · '}
              <span className="discover-row__kind">{user.kind}</span>
            </>
          ) : null}
        </span>
        {user.bio ? <p className="discover-row__bio">{user.bio}</p> : null}
      </div>
      <FollowButton userId={user.id} />
    </div>
  );
}

export function Explore() {
  const [params, setParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('top');
  const q = params.get('q') ?? '';
  const deferredQ = useDeferredValue(q);
  const searchQuery = deferredQ.trim();
  const isSearching = searchQuery.length >= 2;

  const results = useApiQuery(() => endpoints.searchUsers(searchQuery), {
    enabled: isSearching,
    deps: [searchQuery],
  });
  const contentResults = useApiQuery(() => endpoints.searchContent(searchQuery), {
    enabled: isSearching,
    deps: [searchQuery],
  });
  const events = useApiQuery(() => connectApi.events(1, 12));
  const jobs = useApiQuery(() => connectApi.jobs());
  const videos = useApiQuery(() => watchApi.feed(1));
  const feed = useApiQuery(() => endpoints.getFeedItems('foryou', 1));

  const resultList = results.data ?? EMPTY_USERS;
  const contentList = contentResults.data ?? EMPTY_SEARCH_ITEMS;
  const eventList = events.data ?? EMPTY_EVENTS;
  const jobList = jobs.data ?? EMPTY_JOBS;
  const videoList = videos.data ?? EMPTY_VIDEOS;
  const feedList = feed.data ?? EMPTY_FEED_ITEMS;
  const searchRows = useMemo(
    () => interleaveSearchRows(resultList, contentList),
    [contentList, resultList],
  );
  const filteredRows = useMemo(() => {
    if (activeFilter === 'top') return searchRows;
    if (activeFilter === 'profiles') return searchRows.filter((row) => row.kind === 'user');
    if (activeFilter === 'watch') {
      return searchRows.filter((row) => row.kind === 'content' && row.item.kind === 'video');
    }
    return searchRows.filter((row) => row.kind === 'content');
  }, [activeFilter, searchRows]);
  const searchLoading = results.loading || contentResults.loading;
  const upcomingEvents = useMemo(
    () => eventList.filter(isUpcoming).sort(byEventDate).slice(0, 4),
    [eventList],
  );
  const openJobs = useMemo(
    () => jobList.filter((job) => job.hiringStatus === 'open').slice(0, 4),
    [jobList],
  );
  const trendingVideos = useMemo(() => videoList.slice(0, 4), [videoList]);
  const trendingPosts = useMemo(
    () => feedList.filter((item): item is OBFeedItem & { kind: 'post' } => item.kind === 'post').slice(0, 4),
    [feedList],
  );
  const trendingArticles = useMemo(
    () => feedList.filter((item): item is OBFeedItem & { kind: 'article' } => item.kind === 'article').slice(0, 4),
    [feedList],
  );

  function updateQuery(nextQ: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (nextQ.trim()) next.set('q', nextQ);
      else next.delete('q');
      return next;
    }, { replace: true });
  }

  return (
    <div>
      <PageHeader title="Explore" />

      <div className="search">
        <Search size={20} className="search__icon" />
        <input
          className="search__input"
          placeholder="Search people, churches, topics…"
          aria-label="Search people, churches, topics"
          value={q}
          onChange={(e) => updateQuery(e.target.value)}
        />
      </div>

      {isSearching ? (
        <>
          <SectionHeader title={searchLoading ? 'Searching…' : `Results for "${searchQuery}"`} />
          <Segmented value={activeFilter} onChange={setActiveFilter} options={SEARCH_FILTERS} />
          <div className="explore-results">
            {filteredRows.length ? (
              filteredRows.map((row) => <SearchResultRow key={row.id} row={row} />)
            ) : searchLoading ? null : (
              <EmptyState
                icon={<FileText size={30} />}
                title="No results found"
                body="Try another name, topic, church, or ministry keyword."
              />
            )}
          </div>
        </>
      ) : (
        <>
          <ExploreSection title="Upcoming & Local Events">
            {upcomingEvents.length
              ? upcomingEvents.map((event) => <EventRow key={event.id} event={event} />)
              : events.loading
                ? null
                : <EmptyRow label="No live events returned." />}
          </ExploreSection>

          <ExploreSection title="Local Opportunities">
            {openJobs.length
              ? openJobs.map((job) => <JobRow key={job.id} job={job} />)
              : jobs.loading
                ? null
                : <EmptyRow label="No live opportunities returned." />}
          </ExploreSection>

          <ExploreSection title="Trending Videos & Shorts">
            {trendingVideos.length
              ? trendingVideos.map((video) => <VideoRow key={video.id} video={video} />)
              : videos.loading
                ? null
                : <EmptyRow label="No live videos returned." />}
          </ExploreSection>

          <ExploreSection title="Trending Social Posts">
            {trendingPosts.length
              ? trendingPosts.map((post) => <SocialRow key={post.post.id} post={post} />)
              : feed.loading
                ? null
                : <EmptyRow label="No live social posts returned." />}
          </ExploreSection>

          <ExploreSection title="Trending Articles">
            {trendingArticles.length
              ? trendingArticles.map((item) => <ArticleRow key={item.article.id} article={item.article} />)
              : feed.loading
                ? null
                : <EmptyRow label="No live articles returned." />}
          </ExploreSection>
        </>
      )}
    </div>
  );
}
