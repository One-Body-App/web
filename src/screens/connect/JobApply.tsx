import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Sparkles, Upload, X } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { useApiQuery } from '@/api/useApi';
import { ApiError } from '@/api/client';
import { connectApi, CONNECT_JOBS_MOCK } from '@/api/connect';
import './connect-detail.css';

export function JobApply() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const fallback = CONNECT_JOBS_MOCK.find((j) => j.id === id) ?? CONNECT_JOBS_MOCK[0];
  const { data } = useApiQuery(() => connectApi.job(id), { fallback, deps: [id] });
  const job = data ?? fallback;

  const [name, setName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [testimony, setTestimony] = useState('');
  const [resume, setResume] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = Boolean(name && email && phone && location && consent) && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await connectApi.applyToJob(id, { name, email, phone, location, testimony, consentAccepted: consent }, resume);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'We couldn’t submit your application. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="cdetail apply">
        <div className="apply__success">
          <span className="apply__success-icon">
            <CheckCircle2 size={40} />
          </span>
          <h1>Application sent 🙏</h1>
          <p>
            Thank you, {name.split(' ')[0] || 'friend'}. Your application for{' '}
            <strong>{job.title}</strong> has been shared with the ministry team for prayerful review.
            They’ll reach out by email.
          </p>
          <button className="btn btn--brand btn--lg" onClick={() => navigate('/connect')}>
            Back to Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cdetail apply">
      <button className="cdetail__back" onClick={() => navigate(`/connect/serve/${id}`)}>
        <ArrowLeft size={18} /> Back
      </button>

      <div className="apply__hero">
        <span className="apply__hero-icon">
          <Sparkles size={20} />
        </span>
        <h1>Step into your calling.</h1>
        <p>Tell the ministry team a little about you. Fields marked * are required.</p>
      </div>

      <div className="apply__summary card">
        <span className="apply__summary-eyebrow">Applying for</span>
        <strong>{job.title}</strong>
        {job.organizationName ? <span className="apply__summary-org">{job.organizationName}</span> : null}
      </div>

      {error ? (
        <div className="auth-alert auth-alert--error" role="alert" style={{ marginBottom: 'var(--sp-12)' }}>
          {error}
        </div>
      ) : null}

      <form className="apply__form" onSubmit={submit}>
        <label className="apply-field">
          <span>Full name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </label>
        <label className="apply-field">
          <span>Email address *</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <div className="apply__row">
          <label className="apply-field">
            <span>Phone number *</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />
          </label>
          <label className="apply-field">
            <span>Home location *</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="City, State" />
          </label>
        </div>

        <div className="apply-field">
          <span>Resume or ministry portfolio</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            hidden
            onChange={(e) => setResume(e.target.files?.[0] ?? null)}
          />
          {resume ? (
            <div className="apply__file">
              <FileText size={18} />
              <span className="apply__file-name">{resume.name}</span>
              <button type="button" onClick={() => { setResume(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remove">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button type="button" className="apply__upload" onClick={() => fileRef.current?.click()}>
              <Upload size={18} /> Tap to upload — PDF or DOCX (max 5MB)
            </button>
          )}
        </div>

        <label className="apply-field">
          <span>Brief testimony / calling (optional)</span>
          <textarea
            rows={4}
            value={testimony}
            onChange={(e) => setTestimony(e.target.value)}
            placeholder="Share a brief testimony or why you feel led to serve…"
          />
        </label>

        <label className="apply__consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I consent to share these details with the ministry team for prayerful review of this
            application.
          </span>
        </label>

        <button type="submit" className="btn btn--brand btn--lg btn--block" disabled={!canSubmit}>
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </div>
  );
}
