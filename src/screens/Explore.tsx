import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  FileText,
  HeartHandshake,
  MapPin,
  Quote,
  Search,
  Users,
} from 'lucide-react';
import { ArticleCard } from '@/components/ArticleCard';
import { Avatar } from '@/components/Avatar';
import { ConnectionButton } from '@/components/ConnectionButton';
import { FeedVideoCard } from '@/components/FeedVideoCard';
import { PostCard } from '@/components/PostCard';
import { EmptyState, PageHeader, SectionHeader, Segmented } from '@/components/ui';
import { connectApi, type ConnectEvent, type ConnectJob } from '@/api/connect';
import type { OBPost, OBUser } from '@/data/mock';
import { endpoints, type OBFeedItem, type OBSearchItem } from '@/api/endpoints';
import { type WatchVideo, watchApi } from '@/api/watch';
import { PrayerCard } from './PrayerWall';
import { useApiQuery } from '@/api/useApi';
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
  action,
  variant = 'list',
  children,
}: {
  title: string;
  action?: ReactNode;
  variant?: 'list' | 'grid';
  children: ReactNode;
}) {
  return (
    <section className="explore-section">
      <SectionHeader title={title} action={action} />
      <div className={variant === 'grid' ? 'explore-grid' : 'explore-section__rows'}>{children}</div>
    </section>
  );
}

function SectionMore({ to }: { to: string }) {
  return (
    <Link to={to} className="section-more">
      See all <ChevronRight size={15} />
    </Link>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="explore-empty-row">{label}</div>;
}

function EventRow({ event }: { event: ConnectEvent }) {
  const image = event.image?.trim();
  return (
    <Link to={`/connect/events/${event.id}`} className="explore-row">
      <span className="explore-row__thumb explore-row__thumb--event">
        {image ? <img src={image} alt="" loading="lazy" /> : <CalendarDays size={20} />}
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
      <span className="explore-row__thumb explore-row__thumb--serve">
        <HeartHandshake size={20} />
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

function ExploreSocialCard({ post }: { post: OBPost }) {
  const totalReactions = post.reactions.love + post.reactions.pray + post.reactions.rejoice;
  const image = post.image?.trim();
  return (
    <Link
      to={`/post/social/${post.id}`}
      state={{ post }}
      className={`explore-social-card card${image ? '' : ' explore-social-card--text'}`}
    >
      {image ? (
        <span className="explore-social-card__media">
          <img src={image} alt="" loading="lazy" />
        </span>
      ) : (
        <span className="explore-social-card__preview">
          <Quote size={15} />
          <span>{post.body || 'Social post'}</span>
        </span>
      )}
      <span className="explore-social-card__meta">
        <Avatar
          src={post.author.avatar}
          alt={post.author.name}
          size={30}
          verified={post.author.verified}
        />
        <span className="explore-social-card__who">
          <strong>{post.author.name}</strong>
          <small>
            {post.createdAt}
            {totalReactions > 0 ? ` · ${formatCount(totalReactions)} reactions` : ''}
          </small>
        </span>
      </span>
    </Link>
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
      <ConnectionButton targetId={user.id} name={user.name} />
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
          <ExploreSection title="Upcoming & Local Events" action={<SectionMore to="/connect" />}>
            {upcomingEvents.length
              ? upcomingEvents.map((event) => <EventRow key={event.id} event={event} />)
              : events.loading
                ? null
                : <EmptyRow label="No live events returned." />}
          </ExploreSection>

          <ExploreSection
            title="Local Opportunities"
            action={<SectionMore to="/connect?tab=serve" />}
          >
            {openJobs.length
              ? openJobs.map((job) => <JobRow key={job.id} job={job} />)
              : jobs.loading
                ? null
                : <EmptyRow label="No live opportunities returned." />}
          </ExploreSection>

          <ExploreSection
            title="Trending Videos & Shorts"
            variant="grid"
            action={<SectionMore to="/watch" />}
          >
            {trendingVideos.length
              ? trendingVideos.map((video) => (
                  <FeedVideoCard key={video.id} video={video} to="/watch" />
                ))
              : videos.loading
                ? null
                : <EmptyRow label="No live videos returned." />}
          </ExploreSection>

          <ExploreSection
            title="Trending Social Posts"
            variant="grid"
            action={<SectionMore to="/home" />}
          >
            {trendingPosts.length
              ? trendingPosts.map((post) => <ExploreSocialCard key={post.post.id} post={post.post} />)
              : feed.loading
                ? null
                : <EmptyRow label="No live social posts returned." />}
          </ExploreSection>

          <ExploreSection title="Trending Articles" variant="grid" action={<SectionMore to="/home" />}>
            {trendingArticles.length
              ? trendingArticles.map((item) => <ArticleCard key={item.article.id} article={item.article} />)
              : feed.loading
                ? null
                : <EmptyRow label="No live articles returned." />}
          </ExploreSection>
        </>
      )}
    </div>
  );
}
