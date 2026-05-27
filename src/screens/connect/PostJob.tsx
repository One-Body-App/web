import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HeartHandshake } from 'lucide-react';
import { ApiError } from '@/api/client';
import { connectApi, geocodeAddress, type JobDraft } from '@/api/connect';
import './manage.css';

const FREQS = [
  { value: '', label: 'Frequency' },
  { value: 'per_hour', label: 'Per hour' },
  { value: 'per_week', label: 'Per week' },
  { value: 'per_month', label: 'Per month' },
  { value: 'per_year', label: 'Per year' },
];

export function PostJob() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [sector, setSector] = useState('');
  const [opportunityType, setOpportunityType] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('');
  const [inApp, setInApp] = useState(true);
  const [external, setExternal] = useState(false);
  const [applicationUrl, setApplicationUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqList = requirements
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
  const canSubmit =
    Boolean(
      title.trim() &&
        description.trim() &&
        reqList.length &&
        address.trim() &&
        opportunityType.trim() &&
        amount &&
        frequency &&
        (inApp || external),
    ) && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const methods: string[] = [];
    if (inApp) methods.push('in_app');
    if (external) methods.push('external_link');

    // Publish requires a coordinate — geocode the address (free OSM Nominatim).
    const coordinate = await geocodeAddress(address);
    if (!coordinate) {
      setError('We couldn’t locate that address. Try a more specific one (street, city, state).');
      setBusy(false);
      return;
    }

    const draft: JobDraft = {
      title: title.trim(),
      sector: sector.trim() || undefined,
      opportunityType: opportunityType.trim() || undefined,
      description: description.trim() || undefined,
      requirements: reqList,
      address: address.trim() || undefined,
      coordinate,
      compensationAmount: amount ? Number(amount) : undefined,
      compensationFrequency: frequency || undefined,
      applicationMethods: methods,
      applicationUrl: external ? applicationUrl.trim() || undefined : undefined,
    };
    try {
      await connectApi.createJob(draft);
      navigate('/connect/manage', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'Couldn’t publish the opportunity. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cdetail manage">
      <button className="cdetail__back" onClick={() => navigate('/connect/manage')}>
        <ArrowLeft size={18} /> Manage
      </button>

      <div className="apply__hero">
        <span className="apply__hero-icon">
          <HeartHandshake size={20} />
        </span>
        <h1>Post an opportunity</h1>
        <p>Invite your community to serve. Only a title is required to publish.</p>
      </div>

      {error ? (
        <div className="auth-alert auth-alert--error" role="alert" style={{ marginBottom: 'var(--sp-12)' }}>
          {error}
        </div>
      ) : null}

      <form className="apply__form" onSubmit={submit}>
        <label className="apply-field">
          <span>Role title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Kids Ministry Coordinator" />
        </label>
        <div className="apply__row">
          <label className="apply-field">
            <span>Sector</span>
            <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Children & Family" />
          </label>
          <label className="apply-field">
            <span>Type *</span>
            <input value={opportunityType} onChange={(e) => setOpportunityType(e.target.value)} placeholder="Full-time, Volunteer…" />
          </label>
        </div>
        <label className="apply-field">
          <span>Description *</span>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will this person do?" />
        </label>
        <label className="apply-field">
          <span>Requirements * (one per line)</span>
          <textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder={'Background check\nHeart for discipleship'} />
        </label>
        <label className="apply-field">
          <span>Location *</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State" />
        </label>
        <div className="apply__row">
          <label className="apply-field">
            <span>Compensation *</span>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
          </label>
          <label className="apply-field">
            <span>&nbsp;</span>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {FREQS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="apply-field">
          <span>How to apply</span>
          <div className="check-row">
            <label className="check">
              <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} />
              In-app application
            </label>
            <label className="check">
              <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} />
              External link
            </label>
          </div>
        </div>
        {external ? (
          <label className="apply-field">
            <span>Application URL</span>
            <input type="url" value={applicationUrl} onChange={(e) => setApplicationUrl(e.target.value)} placeholder="https://…" />
          </label>
        ) : null}

        <button type="submit" className="btn btn--brand btn--lg btn--block" disabled={!canSubmit}>
          {busy ? 'Publishing…' : 'Publish opportunity'}
        </button>
      </form>
    </div>
  );
}
