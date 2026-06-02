import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, ImagePlus, MapPin, X } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { ApiError } from '@/api/client';
import { ImageCropModal } from '@/components/ImageCropModal';
import { connectApi, geocodeAddress, type EventDraft } from '@/api/connect';
import './manage.css';

export function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [externalEventUrl, setExternalUrl] = useState('');
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [ticketType, setTicketType] = useState<'free' | 'external' | 'paid'>('free');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hero photo — kept in a ref (the File) plus a preview URL for display. An event
  // only appears on the Connect map when it has a photo.
  const photoFileRef = useRef<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cropSrc, setCropSrc] = useState('');

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
  }

  function onCropConfirm(file: File, previewUrl: string) {
    photoFileRef.current = file;
    setPhotoPreview(previewUrl);
    setCropSrc('');
  }

  function removePhoto() {
    photoFileRef.current = null;
    setPhotoPreview('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate || busy) return;
    setBusy(true);
    setError(null);
    // In-person events: geocode the address to a coordinate so the event maps
    // and publishes cleanly (the API rejects a partial location otherwise).
    let coordinate: [number, number] | undefined;
    if (!isOnline && address.trim()) {
      coordinate = await geocodeAddress(address);
    }
    const draft: EventDraft = {
      title: title.trim(),
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      isOnline,
      externalEventUrl: isOnline ? externalEventUrl.trim() || undefined : undefined,
      venueName: !isOnline ? venueName.trim() || undefined : undefined,
      address: !isOnline ? address.trim() || undefined : undefined,
      coordinate,
      startDate,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      ticketType,
      organizerName: user?.fullName,
      tags: tags.split(',').flatMap((t) => {
        const trimmed = t.trim();
        return trimmed ? [trimmed] : [];
      }),
    } as EventDraft & { organizerName?: string };
    try {
      await connectApi.publishEvent(draft, photoFileRef.current);
      navigate('/connect/manage', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'Couldn’t publish the event. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cdetail manage">
      <button type="button" className="cdetail__back" onClick={() => navigate('/connect/manage')}>
        <ArrowLeft size={18} /> Manage
      </button>

      <div className="apply__hero">
        <span className="apply__hero-icon">
          <CalendarPlus size={20} />
        </span>
        <h1>Create an event</h1>
        <p>Invite the Body to gather. Title and date are required to publish.</p>
      </div>

      {error ? (
        <div className="auth-alert auth-alert--error apply__alert" role="alert">
          {error}
        </div>
      ) : null}

      <form className="apply__form" onSubmit={submit}>
        <div className="apply-field">
          <span>Event photo</span>
          {photoPreview ? (
            <div className="evt-photo">
              <img src={photoPreview} alt="" />
              <button
                type="button"
                className="evt-photo__remove"
                onClick={removePhoto}
                aria-label="Remove photo"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="apply__upload evt-photo__pick"
              onClick={() => photoInputRef.current?.click()}
            >
              <ImagePlus size={18} /> Add a featured photo
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPhotoChange}
          />
          <p className={`map-note${photoPreview ? '' : ' map-note--warn'}`}>
            <MapPin size={14} aria-hidden="true" />
            <span>
              {photoPreview
                ? 'Your event will appear on the Connect map.'
                : 'No photo yet — this event will show in the list but not on the Connect map. Add a photo so people can find it on the map.'}
            </span>
          </p>
        </div>

        <label className="apply-field">
          <span>Event title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="City Worship Night" />
        </label>
        <label className="apply-field">
          <span>Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Worship, Outreach, Bible Study…" />
        </label>
        <label className="apply-field">
          <span>Description</span>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's the gathering about?" />
        </label>

        <div className="seg-field">
          <button type="button" className={!isOnline ? 'is-active' : ''} onClick={() => setIsOnline(false)}>
            In person
          </button>
          <button type="button" className={isOnline ? 'is-active' : ''} onClick={() => setIsOnline(true)}>
            Online
          </button>
        </div>

        {isOnline ? (
          <label className="apply-field">
            <span>Event link</span>
            <input type="url" value={externalEventUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
          </label>
        ) : (
          <>
            <label className="apply-field">
              <span>Venue name</span>
              <input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Hillside Auditorium" />
            </label>
            <label className="apply-field">
              <span>Address</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State" />
            </label>
          </>
        )}

        <div className="apply__row">
          <label className="apply-field">
            <span>Date *</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="apply-field">
            <span>Start time</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="apply-field">
            <span>End time</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>

        <label className="apply-field">
          <span>Tickets</span>
          <select value={ticketType} onChange={(e) => setTicketType(e.target.value as typeof ticketType)}>
            <option value="free">Free</option>
            <option value="external">External (RSVP elsewhere)</option>
            <option value="paid">Paid</option>
          </select>
        </label>

        <label className="apply-field">
          <span>Tags (comma separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="worship, all ages" />
        </label>

        <button type="submit" className="btn btn--brand btn--lg btn--block" disabled={!title.trim() || !startDate || busy}>
          {busy ? 'Publishing…' : 'Publish event'}
        </button>
      </form>

      {cropSrc ? (
        <ImageCropModal
          open
          imageSrc={cropSrc}
          aspect={16 / 10}
          cropShape="rect"
          fileName="event-hero.jpg"
          maxSize={1280}
          onCancel={() => setCropSrc('')}
          onConfirm={onCropConfirm}
        />
      ) : null}
    </div>
  );
}
