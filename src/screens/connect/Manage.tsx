import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Eye, HeartHandshake, Plus, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { useApiMutation, useApiQuery } from '@/api/useApi';
import { connectApi, type ConnectEvent } from '@/api/connect';
import './manage.css';

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
      <button
        className={`manage-toggle${live ? ' is-live' : ''}`}
        onClick={() => {
          const next = !live;
          setLive(next);
          toggle.mutate(next);
        }}
      >
        <span className="manage-toggle__dot" />
        {live ? 'Live' : 'Hidden'}
      </button>
    </div>
  );
}

export function ConnectManage() {
  const navigate = useNavigate();
  const events = useApiQuery(() => connectApi.myEvents(), { fallback: [] });
  const jobs = useApiQuery(() => connectApi.myJobs(), { fallback: [] });

  const myEvents = events.data ?? [];
  const myJobs = jobs.data ?? [];

  return (
    <div className="cdetail manage">
      <button className="cdetail__back" onClick={() => navigate('/connect')}>
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
