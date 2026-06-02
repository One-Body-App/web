import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Globe,
  HeartHandshake,
  LayoutList,
  Map as MapIcon,
  MapPin,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import type { MapItem } from '@/components/ConnectMap';
import { EmptyState, PageHeader, Segmented } from '@/components/ui';

// MapLibre is heavy (~800KB) — only load it when the map view is opened.
const ConnectMap = lazy(() =>
  import('@/components/ConnectMap').then((m) => ({ default: m.ConnectMap })),
);
import { useApiMutation, useApiQuery } from '@/api/useApi';
import { endpoints } from '@/api/endpoints';
import {
  connectApi,
  CONNECT_EVENTS_MOCK,
  CONNECT_JOBS_MOCK,
  CONNECT_ORGS_MOCK,
  type ConnectEvent,
  type ConnectJob,
  type ConnectOrg,
} from '@/api/connect';
import './Connect.css';

type Tab = 'go' | 'places' | 'serve';

const TABS: Tab[] = ['go', 'places', 'serve'];
const GO_CHIPS = ['Upcoming', 'Online', 'In Person'] as const;
const PLACE_CHIPS = ['Nearby', 'Churches', 'Non-Profits'] as const;

function hasCoordinates<T extends { lat?: number; lng?: number }>(
  item: T,
): item is T & { lat: number; lng: number } {
  return typeof item.lat === 'number' && typeof item.lng === 'number';
}

export function Connect() {
  const [params] = useSearchParams();
  const requestedTab = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(
    requestedTab && TABS.includes(requestedTab) ? requestedTab : 'go',
  );
  const [view, setView] = useState<'list' | 'map'>('list');
  const [q, setQ] = useState('');
  const [goChip, setGoChip] = useState<string>('Upcoming');
  const [placeChip, setPlaceChip] = useState<string>('Nearby');
  const [serveChip, setServeChip] = useState<string>('All');

  const profile = useApiQuery(() => endpoints.getMyProfileMapped());
  const events = useApiQuery(() => connectApi.events(1, 30, 'trending'), { fallback: CONNECT_EVENTS_MOCK });
  const jobs = useApiQuery(() => connectApi.jobs(), { fallback: CONNECT_JOBS_MOCK });
  const orgs = useApiQuery(() => connectApi.organizations(), { fallback: CONNECT_ORGS_MOCK });
  const isCreator = profile.data?.influencerProfile?.influencerStatus === 'approved';

  const query = q.trim().toLowerCase();

  const visibleEvents = useMemo(() => {
    let list = events.data ?? CONNECT_EVENTS_MOCK;
    if (goChip === 'Online') list = list.filter((e) => e.isOnline);
    else if (goChip === 'In Person') list = list.filter((e) => !e.isOnline);
    if (query)
      list = list.filter((e) =>
        `${e.title} ${e.organizerName ?? ''} ${e.locationLabel} ${e.category ?? ''}`
          .toLowerCase()
          .includes(query),
      );
    return list;
  }, [events.data, goChip, query]);

  const serveTypes = useMemo(() => {
    const set = new Set<string>();
    (jobs.data ?? CONNECT_JOBS_MOCK).forEach((j) => j.opportunityType && set.add(j.opportunityType));
    return ['All', ...Array.from(set).sort()];
  }, [jobs.data]);

  const visibleJobs = useMemo(() => {
    let list = jobs.data ?? CONNECT_JOBS_MOCK;
    if (serveChip !== 'All') list = list.filter((j) => j.opportunityType === serveChip);
    if (query)
      list = list.filter((j) =>
        `${j.title} ${j.organizationName ?? ''} ${j.locationLabel} ${j.sector ?? ''}`
          .toLowerCase()
          .includes(query),
      );
    return list;
  }, [jobs.data, serveChip, query]);

  const visibleOrgs = useMemo(() => {
    let list = orgs.data ?? CONNECT_ORGS_MOCK;
    if (placeChip === 'Churches')
      list = list.filter((o) => /church/i.test(o.organizationTypeLabel ?? ''));
    else if (placeChip === 'Non-Profits')
      list = list.filter((o) => /non.?profit/i.test(o.organizationTypeLabel ?? ''));
    if (query)
      list = list.filter((o) =>
        `${o.title} ${o.address ?? ''} ${o.subtitle ?? ''}`.toLowerCase().includes(query),
      );
    return list;
  }, [orgs.data, placeChip, query]);

  const mapItems: MapItem[] = useMemo(() => {
    if (tab === 'go') {
      const mapped: MapItem[] = [];
      for (const e of visibleEvents) {
        if (!hasCoordinates(e)) continue;
        mapped.push({
          id: e.id,
          lat: e.lat,
          lng: e.lng,
          title: e.title,
          subtitle: e.dateLabel || e.locationLabel,
          image: e.image,
          to: `/connect/events/${e.id}`,
          kind: 'event',
        });
      }
      return mapped;
    }
    if (tab === 'serve') {
      const mapped: MapItem[] = [];
      for (const j of visibleJobs) {
        if (!hasCoordinates(j)) continue;
        mapped.push({
          id: j.id,
          lat: j.lat,
          lng: j.lng,
          title: j.title,
          subtitle: [j.organizationName, j.opportunityType].filter(Boolean).join(' · '),
          to: `/connect/serve/${j.id}`,
          kind: 'job',
        });
      }
      return mapped;
    }
    const mapped: MapItem[] = [];
    for (const o of visibleOrgs) {
      if (!hasCoordinates(o)) continue;
      mapped.push({
        id: o.id,
        lat: o.lat,
        lng: o.lng,
        title: o.title,
        subtitle: o.subtitle,
        image: o.avatar,
        kind: 'place',
      });
    }
    return mapped;
  }, [tab, visibleEvents, visibleJobs, visibleOrgs]);

  const searchPlaceholder =
    tab === 'go' ? 'Search events…' : tab === 'serve' ? 'Search opportunities…' : 'Search places…';

  return (
    <div className="connect">
      <PageHeader
        title="Connect"
        subtitle="Find your people, near and far"
        action={
          <Link to="/connect/manage" className="btn btn--accent btn--sm">
            {isCreator ? (
              <>
                <Plus size={16} /> Create
              </>
            ) : (
              <>
                <CalendarDays size={16} /> Going
              </>
            )}
          </Link>
        }
      />

      <div className="connect__tabs">
        <Segmented
          value={tab}
          onChange={(t) => setTab(t)}
          options={[
            { key: 'go', label: 'Go!' },
            { key: 'places', label: 'Places' },
            { key: 'serve', label: 'Serve' },
          ]}
        />
      </div>

      <div className="search">
        <Search size={20} className="search__icon" />
        <input
          className="search__input"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Filters + view toggle */}
      <div className="connect__filterbar">
        <div className="connect__chips">
        {tab === 'go' &&
          GO_CHIPS.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip${goChip === c ? ' chip--active' : ''}`}
              onClick={() => setGoChip(c)}
            >
              {c}
            </button>
          ))}
        {tab === 'serve' &&
          serveTypes.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip${serveChip === c ? ' chip--active' : ''}`}
              onClick={() => setServeChip(c)}
            >
              {c}
            </button>
          ))}
        {tab === 'places' &&
          PLACE_CHIPS.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip${placeChip === c ? ' chip--active' : ''}`}
              onClick={() => setPlaceChip(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="connect__viewtoggle" role="tablist" aria-label="View mode">
          {view === 'list' ? (
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="is-active"
              onClick={() => setView('list')}
              aria-label="List view"
            >
              <LayoutList size={17} />
            </button>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected="false"
              onClick={() => setView('list')}
              aria-label="List view"
            >
              <LayoutList size={17} />
            </button>
          )}
          {view === 'map' ? (
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="is-active"
              onClick={() => setView('map')}
              aria-label="Map view"
            >
              <MapIcon size={17} />
            </button>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected="false"
              onClick={() => setView('map')}
              aria-label="Map view"
            >
              <MapIcon size={17} />
            </button>
          )}
        </div>
      </div>

      {view === 'map' ? (
        <Suspense
          fallback={
            <div className="skeleton connect__map-skeleton" />
          }
        >
          <ConnectMap items={mapItems} />
        </Suspense>
      ) : (
        <>
      {/* Panels */}
      {tab === 'go' && (
        <Panel
          loading={events.loading && !events.data}
          empty={visibleEvents.length === 0}
          emptyIcon={<CalendarDays size={30} />}
          emptyTitle="No events found"
          emptyBody="Try a different filter, or check back soon for gatherings near you."
        >
          <div className="connect-grid">
            {visibleEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </Panel>
      )}

      {tab === 'serve' && (
        <Panel
          loading={jobs.loading && !jobs.data}
          empty={visibleJobs.length === 0}
          emptyIcon={<HeartHandshake size={30} />}
          emptyTitle="No opportunities found"
          emptyBody="Try a different filter — new ways to serve are added often."
        >
          <div className="serve-list">
            {visibleJobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </Panel>
      )}

      {tab === 'places' && (
        <Panel
          loading={orgs.loading && !orgs.data}
          empty={visibleOrgs.length === 0}
          emptyIcon={<MapPin size={30} />}
          emptyTitle="No places found"
          emptyBody="Try a different filter to discover churches and ministries near you."
        >
          <div className="places-list">
            {visibleOrgs.map((o) => (
              <PlaceCard key={o.id} org={o} />
            ))}
          </div>
        </Panel>
      )}
        </>
      )}
    </div>
  );
}

/* ---------------- Panel (loading / empty wrapper) ---------------- */
function Panel({
  loading,
  empty,
  emptyIcon,
  emptyTitle,
  emptyBody,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="connect-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton connect__card-skeleton" />
        ))}
      </div>
    );
  }
  if (empty) return <EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} />;
  return <>{children}</>;
}

/* ---------------- Cards ---------------- */
function EventCard({ event }: { event: ConnectEvent }) {
  return (
    <Link to={`/connect/events/${event.id}`} className="event-card card">
      <div className="event-card__media">
        {event.image ? <img src={event.image} alt="" loading="lazy" /> : <div className="event-card__noimg" />}
        {event.category ? <span className="event-card__cat">{event.category}</span> : null}
        {event.isOnline ? (
          <span className="event-card__online">
            <Globe size={12} /> Online
          </span>
        ) : null}
      </div>
      <div className="event-card__body">
        <h3>{event.title}</h3>
        {event.organizerName ? <p className="event-card__host">{event.organizerName}</p> : null}
        <div className="event-card__rows">
          <span>
            <CalendarDays size={15} /> {event.dateLabel || 'Date TBA'}
          </span>
          <span>
            <MapPin size={15} /> {event.locationLabel}
          </span>
          {event.attendees > 0 ? (
            <span>
              <Users size={15} /> {event.attendees} going
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function JobCard({ job }: { job: ConnectJob }) {
  return (
    <Link to={`/connect/serve/${job.id}`} className="serve-card card">
      <div className="serve-card__icon">
        <HeartHandshake size={24} />
      </div>
      <div className="serve-card__body">
        <div className="serve-card__top">
          <h3>{job.title}</h3>
          {job.hiringStatus === 'open' ? <span className="serve-card__hiring">Hiring</span> : null}
        </div>
        <p className="serve-card__org">
          {job.organizationName ?? 'One Body'} · {job.opportunityType ?? 'Opportunity'}
        </p>
        <div className="serve-card__meta">
          <span>
            <MapPin size={14} /> {job.locationLabel}
          </span>
          {job.compensationLabel ? <span className="serve-card__pay">{job.compensationLabel}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function PlaceCard({ org }: { org: ConnectOrg }) {
  const [following, setFollowing] = useState(false);
  const follow = useApiMutation((id: string) => endpoints.followUser(id));
  const unfollow = useApiMutation((id: string) => endpoints.unfollowUser(id));
  return (
    <div className="place-card card">
      <Avatar src={org.avatar ?? '/brand/avatar1.png'} alt={org.title} size={52} />
      <div className="place-card__body">
        <strong>{org.title}</strong>
        {org.subtitle ? <span className="place-card__sub">{org.subtitle}</span> : null}
        <span className="place-card__meta">
          <MapPin size={13} /> {org.address ?? 'Location unavailable'}
          {org.distanceLabel ? ` · ${org.distanceLabel}` : ''}
        </span>
      </div>
      <button
        type="button"
        className={`btn btn--sm ${following ? 'btn--outline' : 'btn--accent'}`}
        onClick={() => {
          const next = !following;
          setFollowing(next);
          (next ? follow.mutate(org.id) : unfollow.mutate(org.id));
        }}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
