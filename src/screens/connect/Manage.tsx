import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Check,
  Eye,
  HeartHandshake,
  MapPin,
  Plus,
  Users,
} from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { useApiMutation, useApiQuery } from '@/api/useApi';
import { endpoints, type MyProfile } from '@/api/endpoints';
import { connectApi, type ConnectEvent } from '@/api/connect';
import './manage.css';

function isApprovedCreator(profile?: MyProfile) {
  return profile?.influencerProfile?.influencerStatus === 'approved';
}

function isUpcoming(event: ConnectEvent) {
  if (!event.startDate) return false;
  return event.startDate >= new Date().toISOString().slice(0, 10);
}

function EventManageRow({ event }: { event: ConnectEvent }) {
  const [live, setLive] = useState(event.live !== false);
  const toggle = useApiMutation((isLive: boolean) => connectApi.setEventLive(event.id, isLive));
  return (
    <div className="manage-row card">
      <div className="manage-row__main">
        <Link to={`/connect/events/${event.id}`} className="manage-row__title">
          {event.title}
        </Link>
        <div className="manage-row__meta">
          <span>{event.dateLabel || 'Date TBA'}</span>
          <span>
            <Eye size={13} /> {event.views ?? 0}
          </span>
          <span>
            <Users size={13} /> {event.attendees}
          </span>
        </div>
      </div>
      {live ? (
        <button
          type="button"
          className="manage-toggle is-live"
          onClick={() => {
            setLive(false);
            toggle.mutate(false);
          }}
          aria-pressed="true"
        >
          <span className="manage-toggle__dot" />
          Live
        </button>
      ) : (
        <button
          type="button"
          className="manage-toggle"
          onClick={() => {
            setLive(true);
            toggle.mutate(true);
          }}
          aria-pressed="false"
        >
          <span className="manage-toggle__dot" />
          Hidden
        </button>
      )}
    </div>
  );
}

function GoingEventRow({
  event,
  removing,
  onNotGoing,
}: {
  event: ConnectEvent;
  removing: boolean;
  onNotGoing: () => void;
}) {
  return (
    <div className="manage-row card">
      <div className="manage-row__main">
        <Link to={`/connect/events/${event.id}`} className="manage-row__title">
          {event.title}
        </Link>
        <div className="manage-row__meta">
          <span>
            <CalendarDays size={13} /> {event.dateLabel || 'Date TBD'}
          </span>
          <span>
            <MapPin size={13} /> {event.locationLabel}
          </span>
          <span>
            <Users size={13} /> {event.attendees} going
          </span>
        </div>
      </div>
      <div className="manage-row__actions">
        <Link to={`/connect/events/${event.id}`} className="btn btn--outline btn--sm">
          View Event
        </Link>
        <button type="button" className="btn btn--outline btn--sm" onClick={onNotGoing} disabled={removing}>
          {removing ? 'Saving...' : 'Not Going'}
        </button>
      </div>
    </div>
  );
}

export function ConnectManage() {
  const navigate = useNavigate();
  const profile = useApiQuery(() => endpoints.getMyProfileMapped());
  const creator = isApprovedCreator(profile.data);
  const profileResolved = Boolean(profile.data || profile.error);
  const events = useApiQuery(() => connectApi.myEvents(), {
    fallback: [],
    enabled: creator,
    deps: [creator],
  });
  const jobs = useApiQuery(() => connectApi.myJobs(), {
    fallback: [],
    enabled: creator,
    deps: [creator],
  });
  const going = useApiQuery(() => connectApi.goingEvents(), {
    fallback: [],
    enabled: profileResolved && !creator,
    deps: [profileResolved, creator],
  });
  const notGoing = useApiMutation((eventId: string) => connectApi.setEventGoing(eventId, false));

  const myEvents = events.data ?? [];
  const myJobs = jobs.data ?? [];
  const goingEvents = going.data ?? [];
  const upcomingGoing = goingEvents.filter(isUpcoming).length;
  const onlineGoing = goingEvents.filter((event) => event.isOnline).length;

  async function handleNotGoing(eventId: string) {
    await notGoing.mutate(eventId);
    going.refetch();
  }

  if (profile.loading && !profile.data) {
    return (
      <div className="cdetail manage">
        <button type="button" className="cdetail__back" onClick={() => navigate('/connect')}>
          <ArrowLeft size={18} /> Connect
        </button>
        <div className="skeleton" style={{ height: 180, borderRadius: 'var(--r-card)' }} />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="cdetail manage">
        <button type="button" className="cdetail__back" onClick={() => navigate('/connect')}>
          <ArrowLeft size={18} /> Connect
        </button>

        <header className="manage__head">
          <h1>Go! Dashboard</h1>
          <p>Events you have said you are going to.</p>
        </header>

        <div className="manage__stats" aria-label="Going event stats">
          <div className="manage__stat">
            <span>Going</span>
            <strong>{goingEvents.length}</strong>
          </div>
          <div className="manage__stat">
            <span>Upcoming</span>
            <strong>{upcomingGoing}</strong>
          </div>
          <div className="manage__stat">
            <span>Online</span>
            <strong>{onlineGoing}</strong>
          </div>
        </div>

        <section className="manage__section">
          <h2>Going</h2>
          {going.loading && !going.data ? (
            <div className="skeleton" style={{ height: 72, borderRadius: 'var(--r-card)' }} />
          ) : goingEvents.length ? (
            <div className="manage-list">
              {goingEvents.map((event) => (
                <GoingEventRow
                  key={event.id}
                  event={event}
                  removing={notGoing.loading}
                  onNotGoing={() => void handleNotGoing(event.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Check size={28} />}
              title="No Going events yet"
              body="Tap Go! on an event to add it here."
            />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="cdetail manage">
      <button type="button" className="cdetail__back" onClick={() => navigate('/connect')}>
        <ArrowLeft size={18} /> Connect
      </button>

      <header className="manage__head">
        <h1>Organizer hub</h1>
        <p>Create and manage events and serve opportunities for your community.</p>
      </header>

      <div className="manage__cta">
        <Link to="/connect/manage/events/new" className="manage__cta-card card">
          <span className="manage__cta-icon manage__cta-icon--event">
            <CalendarPlus size={22} />
          </span>
          <div>
            <strong>Create an event</strong>
            <span>Gatherings, services, outreach</span>
          </div>
          <Plus size={18} className="manage__cta-plus" />
        </Link>
        <Link to="/connect/manage/jobs/new" className="manage__cta-card card">
          <span className="manage__cta-icon manage__cta-icon--job">
            <HeartHandshake size={22} />
          </span>
          <div>
            <strong>Post an opportunity</strong>
            <span>Jobs, volunteer & serve roles</span>
          </div>
          <Plus size={18} className="manage__cta-plus" />
        </Link>
      </div>

      <section className="manage__section">
        <h2>Your events</h2>
        {events.loading && !events.data ? (
          <div className="skeleton" style={{ height: 72, borderRadius: 'var(--r-card)' }} />
        ) : myEvents.length ? (
          <div className="manage-list">
            {myEvents.map((e) => (
              <EventManageRow key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <p className="manage__empty">No events yet. Create your first above.</p>
        )}
      </section>

      <section className="manage__section">
        <h2>Your opportunities</h2>
        {jobs.loading && !jobs.data ? (
          <div className="skeleton" style={{ height: 72, borderRadius: 'var(--r-card)' }} />
        ) : myJobs.length ? (
          <div className="manage-list">
            {myJobs.map((j) => (
              <div key={j.id} className="manage-row card">
                <div className="manage-row__main">
                  <Link to={`/connect/serve/${j.id}`} className="manage-row__title">
                    {j.title}
                  </Link>
                  <div className="manage-row__meta">
                    <span>{j.opportunityType ?? 'Opportunity'}</span>
                    <span className={j.hiringStatus === 'open' ? 'manage-row__open' : ''}>
                      {j.hiringStatus === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </div>
                </div>
                <Link to={`/connect/serve/${j.id}/applications`} className="btn btn--outline btn--sm">
                  <Users size={15} /> {j.applicantCount} applicant{j.applicantCount === 1 ? '' : 's'}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<HeartHandshake size={28} />}
            title="No opportunities yet"
            body="Post a role to invite your community to serve."
          />
        )}
      </section>
    </div>
  );
}
