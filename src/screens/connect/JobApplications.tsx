import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Inbox, Mail, MapPin, Phone } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { useApiQuery } from '@/api/useApi';
import { connectApi } from '@/api/connect';
import './manage.css';

export function JobApplications() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading } = useApiQuery(() => connectApi.jobApplications(id), {
    fallback: [],
    deps: [id],
  });
  const applicants = data ?? [];

  return (
    <div className="cdetail manage">
      <button type="button" className="cdetail__back" onClick={() => navigate('/connect/manage')}>
        <ArrowLeft size={18} /> Manage
      </button>

      <header className="manage__head">
        <h1>Applications</h1>
        <p>{applicants.length} application{applicants.length === 1 ? '' : 's'} received</p>
      </header>

      {loading && !data ? (
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--r-card)' }} />
      ) : applicants.length ? (
        <div className="manage-list">
          {applicants.map((a) => (
            <article key={a.id} className="applicant card">
              <div className="applicant__head">
                <span className="applicant__avatar">{a.name.charAt(0)}</span>
                <div>
                  <strong>{a.name}</strong>
                  {a.location ? (
                    <span className="applicant__loc">
                      <MapPin size={13} /> {a.location}
                    </span>
                  ) : null}
                </div>
              </div>
              {a.testimony ? <p className="applicant__testimony">“{a.testimony}”</p> : null}
              <div className="applicant__contact">
                {a.email ? (
                  <a href={`mailto:${a.email}`} className="applicant__chip">
                    <Mail size={14} /> {a.email}
                  </a>
                ) : null}
                {a.phone ? (
                  <a href={`tel:${a.phone}`} className="applicant__chip">
                    <Phone size={14} /> {a.phone}
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Inbox size={28} />}
          title="No applications yet"
          body="When someone applies, their details will appear here for prayerful review."
        />
      )}
    </div>
  );
}
