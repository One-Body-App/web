import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Tag,
} from 'lucide-react';
import { useApiQuery } from '@/api/useApi';
import { connectApi, CONNECT_JOBS_MOCK } from '@/api/connect';
import './connect-detail.css';

export function JobDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const fallback = CONNECT_JOBS_MOCK.find((j) => j.id === id) ?? CONNECT_JOBS_MOCK[0];
  const { data, loading } = useApiQuery(() => connectApi.job(id), { fallback, deps: [id] });
  const job = data ?? fallback;

  const canApplyInApp = job.applicationMethods.length === 0 || job.applicationMethods.includes('in_app');

  function apply() {
    if (canApplyInApp) {
      navigate(`/connect/serve/${id}/apply`);
    } else if (job.applicationUrl) {
      window.open(job.applicationUrl, '_blank', 'noreferrer');
    }
  }

  if (loading && !data) {
    return (
      <div className="cdetail">
        <div className="skeleton" style={{ height: 180, borderRadius: 'var(--r-card)' }} />
      </div>
    );
  }

  return (
    <div className="cdetail">
      <button type="button" className="cdetail__back" onClick={() => navigate('/connect')}>
        <ArrowLeft size={18} /> Connect
      </button>

      <div className="jdetail__head">
        <h1 className="cdetail__title">{job.title}</h1>
        <div className="jdetail__meta">
          {job.sector ? (
            <span>
              <Tag size={15} /> {job.sector}
            </span>
          ) : null}
          <span>
            <MapPin size={15} /> {job.locationLabel}
          </span>
          {job.hiringStatus === 'open' ? (
            <span className="jdetail__open">
              <CheckCircle2 size={15} /> Hiring now
            </span>
          ) : (
            <span className="jdetail__closed">Closed</span>
          )}
        </div>
      </div>

      <div className="cdetail__actions cdetail__actions--top">
        <button type="button" className="btn btn--brand btn--block" onClick={apply} disabled={job.hiringStatus === 'closed'}>
          {canApplyInApp ? 'Apply' : (
            <>
              Apply <ExternalLink size={16} />
            </>
          )}
        </button>
        <button
          type="button"
          className={`btn cdetail__save ${saved ? 'btn--primary' : 'btn--outline'}`}
          onClick={() => setSaved((s) => !s)}
          aria-label="Save"
        >
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {job.organizationName ? (
        <section className="jdetail__card card">
          <h2 className="cdetail__label">Posted by</h2>
          <p className="jdetail__org">
            <Building2 size={18} /> {job.organizationName}
            {job.denomination ? <span className="jdetail__denom"> · {job.denomination}</span> : null}
          </p>
        </section>
      ) : null}

      {job.description ? (
        <section className="cdetail__section">
          <h2 className="cdetail__label">Description</h2>
          <p className="cdetail__desc">{job.description}</p>
        </section>
      ) : null}

      {job.requirements.length ? (
        <section className="cdetail__section">
          <h2 className="cdetail__label">Requirements</h2>
          <ul className="jdetail__reqs">
            {job.requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="jdetail__grid">
        {job.compensationLabel ? (
          <div className="jdetail__stat">
            <span className="cdetail__label">Compensation</span>
            <strong>{job.compensationLabel}</strong>
          </div>
        ) : null}
        {job.opportunityType ? (
          <div className="jdetail__stat">
            <span className="cdetail__label">Type</span>
            <strong>{job.opportunityType}</strong>
          </div>
        ) : null}
        <div className="jdetail__stat">
          <span className="cdetail__label">Applicants</span>
          <strong>{job.applicantCount}</strong>
        </div>
      </div>
    </div>
  );
}
