import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, ExternalLink, Globe, MapPin, Share2 } from 'lucide-react';
import { useApiQuery } from '@/api/useApi';
import { connectApi, CONNECT_EVENTS_MOCK } from '@/api/connect';
import './connect-detail.css';

export function EventDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [going, setGoing] = useState(false);

  const fallback = CONNECT_EVENTS_MOCK.find((e) => e.id === id) ?? CONNECT_EVENTS_MOCK[0];
  const { data, loading } = useApiQuery(() => connectApi.event(id), { fallback, deps: [id] });
  const event = data ?? fallback;

  useEffect(() => {
    if (id) connectApi.trackEvent(id, 'open');
  }, [id]);

  if (loading && !data) {
    return (
      <div className="cdetail">
        <div className="skeleton" style={{ height: 240, borderRadius: 'var(--r-card)' }} />
      </div>
    );
  }

  return (
    <div className="cdetail">
      <button type="button" className="cdetail__back" onClick={() => navigate('/connect')}>
        <ArrowLeft size={18} /> Connect
      </button>

      <div className="cdetail__hero">
        {event.image ? <img src={event.image} alt="" /> : <div className="cdetail__hero-fallback" />}
        {event.category ? <span className="cdetail__badge">{event.category}</span> : null}
      </div>

      <h1 className="cdetail__title">{event.title}</h1>

      <section className="cdetail__section">
        <h2 className="cdetail__label">Date &amp; Time</h2>
        <p className="cdetail__row">
          <CalendarDays size={18} />
          <span>
            {event.dateLabel || 'To be announced'}
            {event.endTime ? ` – ${event.endTime}` : ''}
          </span>
        </p>
      </section>

      <section className="cdetail__section">
        <h2 className="cdetail__label">Location</h2>
        <p className="cdetail__row">
          {event.isOnline ? <Globe size={18} /> : <MapPin size={18} />}
          <span>
            {event.locationLabel}
            {event.address && event.venueName ? <small> · {event.address}</small> : null}
          </span>
        </p>
      </section>

      {event.organizerName ? (
        <section className="cdetail__organizer">
          <div className="cdetail__organizer-avatar">{event.organizerName.charAt(0)}</div>
          <div>
            <strong>{event.organizerName}</strong>
            {event.organizerRole ? <span>{event.organizerRole}</span> : null}
          </div>
        </section>
      ) : null}

      {event.description ? (
        <section className="cdetail__section">
          <h2 className="cdetail__label">About the event</h2>
          <p className="cdetail__desc">{event.description}</p>
        </section>
      ) : null}

      {event.tags.length ? (
        <div className="cdetail__tags">
          {event.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="cdetail__actions">
        {event.externalEventUrl ? (
          <a
            className="btn btn--brand btn--lg btn--block"
            href={event.externalEventUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => connectApi.trackEvent(id, 'register')}
          >
            Go! <ExternalLink size={18} />
          </a>
        ) : (
          <button
            type="button"
            className={`btn btn--lg btn--block ${going ? 'btn--outline' : 'btn--brand'}`}
            onClick={() => {
              setGoing((g) => !g);
              if (!going) connectApi.trackEvent(id, 'register');
            }}
          >
            {going ? (
              <>
                <Check size={18} /> You’re going
              </>
            ) : (
              "Go! I'm attending"
            )}
          </button>
        )}
        <Link to="/connect" className="btn btn--outline cdetail__share" aria-label="Back to Connect">
          <Share2 size={18} />
        </Link>
      </div>
    </div>
  );
}
