import { api, ApiError } from './client';
import { API_BASE_URL } from './config';
import { getAuthToken } from './token';

/* ============================ UI types ============================ */
export interface ConnectEvent {
  id: string;
  title: string;
  category?: string;
  image?: string;
  organizerName?: string;
  organizerRole?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  dateLabel: string;
  isOnline: boolean;
  externalEventUrl?: string;
  venueName?: string;
  address?: string;
  locationLabel: string;
  description?: string;
  attendees: number;
  views?: number;
  isGoing?: boolean;
  ticketType?: string;
  tags: string[];
  live?: boolean;
  lat?: number;
  lng?: number;
}

export interface ConnectJob {
  id: string;
  title: string;
  organizationName?: string;
  denomination?: string;
  sector?: string;
  opportunityType?: string;
  address?: string;
  locationLabel: string;
  description?: string;
  requirements: string[];
  compensationLabel?: string;
  applicationMethods: string[];
  applicationUrl?: string;
  hiringStatus: 'open' | 'closed';
  applicantCount: number;
  updatedAt?: string;
  lat?: number;
  lng?: number;
}

export interface ConnectOrg {
  id: string;
  title: string;
  address?: string;
  avatar?: string;
  organizationTypeLabel?: string;
  churchTypeLabel?: string;
  subtitle?: string;
  distanceLabel?: string;
  lat?: number;
  lng?: number;
}

export interface JobApplication {
  name: string;
  email: string;
  phone: string;
  location: string;
  testimony?: string;
  consentAccepted: boolean;
}

/** Organizer create/edit payloads. */
export interface EventDraft {
  eventId?: string;
  title: string;
  category?: string;
  description?: string;
  isOnline?: boolean;
  externalEventUrl?: string;
  venueName?: string;
  address?: string;
  coordinate?: [number, number];
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  ticketType?: 'free' | 'external' | 'paid';
  tags?: string[];
}

export interface JobDraft {
  title?: string;
  sector?: string;
  opportunityType?: string;
  description?: string;
  requirements?: string[];
  address?: string;
  coordinate?: [number, number];
  compensationAmount?: number;
  compensationFrequency?: string;
  applicationMethods?: string[];
  applicationUrl?: string;
}

export interface JobApplicant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  testimony?: string;
  createdAt?: string;
}

/* ============================ Helpers ============================ */
function formatDate(date?: string, time?: string): string {
  if (!date) return time ?? '';
  const parsed = new Date(`${date}T12:00:00`);
  let label = date;
  if (!Number.isNaN(parsed.getTime())) {
    label = parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  return time ? `${label} · ${time}` : label;
}

const FREQ_LABEL: Record<string, string> = {
  per_hour: '/hr',
  per_week: '/wk',
  per_month: '/mo',
  per_year: '/yr',
};

function compensationLabel(amount?: number | null, freq?: string): string | undefined {
  if (amount == null || !Number.isFinite(amount)) return undefined;
  const money = `$${amount.toLocaleString()}`;
  return freq && FREQ_LABEL[freq] ? `${money}${FREQ_LABEL[freq]}` : money;
}

/* ============================ Raw shapes (loose) ============================ */
type Raw = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const MAPBOX_PUBLIC_TOKEN = (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN ?? '').trim();

/** Extracts { lat, lng } from a GeoJSON Point ([lon,lat]), a [lon,lat] tuple, or {lat,lon|lng}. */
function coords(...sources: unknown[]): { lat?: number; lng?: number } {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    const o = src as Record<string, unknown>;
    const arr = (Array.isArray(o.coordinates) ? o.coordinates : Array.isArray(src) ? src : null) as
      | number[]
      | null;
    if (arr && arr.length >= 2 && Number.isFinite(arr[0]) && Number.isFinite(arr[1])) {
      return { lng: arr[0], lat: arr[1] };
    }
    const lat = o.lat ?? o.latitude;
    const lng = o.lng ?? o.lon ?? o.longitude;
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return {};
}

/** Drops undefined/null/empty values so optional API fields aren't sent blank. */
function strip(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function unwrap(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  if (payload && typeof payload === 'object') {
    const o = payload as Raw;
    for (const key of ['items', 'data', 'events', 'jobs', 'organizations', 'results', 'content']) {
      if (Array.isArray(o[key])) return o[key] as Raw[];
    }
  }
  return [];
}

/* ============================ Mappers ============================ */
export function mapEvent(e: Raw): ConnectEvent {
  const isOnline = Boolean(e.isOnline);
  const venueName = str(e.venueName);
  const address = str(e.address);
  const locationLabel = isOnline
    ? 'Online event'
    : venueName ?? address ?? str(e.locationQuery) ?? 'Location TBA';
  return {
    id: String(e._id ?? e.id ?? ''),
    title: str(e.title) ?? 'Untitled event',
    category: str(e.category) ?? str(e.eventType),
    image: str(e.heroImageUri) ?? str(e.photoUri),
    organizerName: str(e.organizerName),
    organizerRole: str(e.organizerRole),
    startDate: str(e.startDate),
    startTime: str(e.startTime),
    endDate: str(e.endDate),
    endTime: str(e.endTime),
    dateLabel: formatDate(str(e.startDate), str(e.startTime)),
    isOnline,
    externalEventUrl: str(e.externalEventUrl),
    venueName,
    address,
    locationLabel,
    description: str(e.description),
    attendees: num(e.registrationCount),
    views: num(e.viewCount),
    isGoing: e.isGoing === true,
    ticketType: str(e.ticketType),
    tags: Array.isArray(e.tags) ? (e.tags as string[]) : [],
    live: e.isLive !== false,
    ...coords(e.location, e.coordinate),
  };
}

export function mapJob(j: Raw): ConnectJob {
  const address = str(j.address);
  return {
    id: String(j._id ?? j.id ?? ''),
    title: str(j.title) ?? 'Open opportunity',
    organizationName: str(j.organizationName),
    denomination: str(j.denomination),
    sector: str(j.sector),
    opportunityType: str(j.opportunityType),
    address,
    locationLabel: address ?? str(j.locationQuery) ?? 'Flexible',
    description: str(j.description),
    requirements: Array.isArray(j.requirements) ? (j.requirements as string[]) : [],
    compensationLabel: compensationLabel(
      j.compensationAmount as number | null | undefined,
      str(j.compensationFrequency),
    ),
    applicationMethods: Array.isArray(j.applicationMethods) ? (j.applicationMethods as string[]) : [],
    applicationUrl: str(j.applicationUrl),
    hiringStatus: j.hiringStatus === 'closed' ? 'closed' : 'open',
    applicantCount: num(j.applicantCount),
    updatedAt: str(j.updatedAt),
    ...coords(j.location, j.coordinate),
  };
}

export function mapOrg(o: Raw): ConnectOrg {
  const typeLabel = str(o.organizationTypeLabel);
  const churchLabel = str(o.churchTypeLabel);
  return {
    id: String(o.id ?? o._id ?? ''),
    title: str(o.title) ?? str(o.name) ?? 'Organization',
    address: str(o.address),
    avatar: str(o.avatarUri) ?? str(o.profileImage),
    organizationTypeLabel: typeLabel,
    churchTypeLabel: churchLabel,
    subtitle: [typeLabel, churchLabel].filter(Boolean).join(' · ') || undefined,
    distanceLabel: str(o.distanceLabel),
    ...coords(o.coordinate, o.location),
  };
}

function mapApplicant(a: Raw): JobApplicant {
  return {
    id: String(a._id ?? a.id ?? Math.random()),
    name: str(a.name) ?? 'Applicant',
    email: str(a.email),
    phone: str(a.phone),
    location: str(a.location),
    testimony: str(a.testimony),
    createdAt: str(a.createdAt),
  };
}

async function geocodeAddressWithMapbox(query: string): Promise<[number, number] | undefined> {
  if (!MAPBOX_PUBLIC_TOKEN) return undefined;
  try {
    const params = new URLSearchParams({
      q: query,
      limit: '1',
      access_token: MAPBOX_PUBLIC_TOKEN,
    });
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: number[] } }>;
    };
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (
      coordinates &&
      coordinates.length >= 2 &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1])
    ) {
      return [coordinates[0], coordinates[1]];
    }
  } catch {
    /* fall through to Nominatim */
  }
  return undefined;
}

/** Geocode an address to [lng, lat] via Mapbox, then OSM Nominatim as fallback. */
export async function geocodeAddress(address: string): Promise<[number, number] | undefined> {
  const q = address.trim();
  if (!q) return undefined;
  const mapboxCoordinate = await geocodeAddressWithMapbox(q);
  if (mapboxCoordinate) return mapboxCoordinate;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json' } },
    );
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = Array.isArray(data) ? data[0] : undefined;
    const lng = Number(hit?.lon);
    const lat = Number(hit?.lat);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  } catch {
    /* ignore — caller handles missing coordinate */
  }
  return undefined;
}

/** Build a "City, State" label from separate place + region parts. */
function placeLabel(place?: string, region?: string): string | undefined {
  const parts = [place, region].map((p) => p?.trim()).filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

async function reverseGeocodeWithMapbox(lng: number, lat: number): Promise<string | undefined> {
  if (!MAPBOX_PUBLIC_TOKEN) return undefined;
  try {
    const params = new URLSearchParams({
      longitude: String(lng),
      latitude: String(lat),
      limit: '1',
      types: 'place,region',
      access_token: MAPBOX_PUBLIC_TOKEN,
    });
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      features?: Array<{ properties?: { name?: string; context?: Record<string, { name?: string }> } }>;
    };
    const props = data.features?.[0]?.properties;
    const place = props?.context?.place?.name ?? props?.name;
    const region = props?.context?.region?.name;
    return placeLabel(place, region);
  } catch {
    /* fall through to Nominatim */
  }
  return undefined;
}

/** Reverse-geocode coordinates to a "City, State" label via Mapbox, then OSM Nominatim. */
export async function reverseGeocode(lng: number, lat: number): Promise<string | undefined> {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  const mapboxLabel = await reverseGeocodeWithMapbox(lng, lat);
  if (mapboxLabel) return mapboxLabel;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lon=${encodeURIComponent(
        String(lng),
      )}&lat=${encodeURIComponent(String(lat))}`,
      { headers: { Accept: 'application/json' } },
    );
    const data = (await res.json()) as {
      address?: { city?: string; town?: string; village?: string; state?: string };
    };
    const addr = data.address;
    const place = addr?.city ?? addr?.town ?? addr?.village;
    return placeLabel(place, addr?.state);
  } catch {
    /* ignore — caller handles missing label */
  }
  return undefined;
}

/* ============================ Endpoints ============================ */
export type EventGoingResponse = {
  event: ConnectEvent | null;
  isGoing: boolean;
  registrationCount: number;
  changed?: boolean;
};

export const connectApi = {
  async events(page = 1, limit = 30, sort?: 'trending'): Promise<ConnectEvent[]> {
    return unwrap(await api.get('connect/events/public', { page, limit, sort })).map(mapEvent);
  },
  async event(id: string): Promise<ConnectEvent> {
    const payload = await api.get<Raw>(`connect/events/${id}`);
    const raw = (payload?.event ?? payload?.data ?? payload) as Raw;
    return mapEvent(raw);
  },
  async jobs(): Promise<ConnectJob[]> {
    return unwrap(await api.get('connect/jobs/public')).map(mapJob);
  },
  async job(id: string): Promise<ConnectJob> {
    const payload = await api.get<Raw>(`connect/jobs/${id}`);
    const raw = (payload?.job ?? payload?.data ?? payload) as Raw;
    return mapJob(raw);
  },
  async organizations(query: { text?: string; sort?: string } = {}): Promise<ConnectOrg[]> {
    return unwrap(await api.get('connect/organizations/public', query)).map(mapOrg);
  },
  // ---- Organizer / creator ----
  async myEvents(): Promise<ConnectEvent[]> {
    return unwrap(await api.get('connect/events/mine')).map(mapEvent);
  },
  async goingEvents(): Promise<ConnectEvent[]> {
    return unwrap(await api.get('connect/events/going')).map((event) => ({
      ...mapEvent(event),
      isGoing: true,
    }));
  },
  async myJobs(): Promise<ConnectJob[]> {
    return unwrap(await api.get('connect/jobs/mine')).map(mapJob);
  },
  /** Events publish via multipart (controller uses FileInterceptor), matching mobile. */
  async publishEvent(body: EventDraft & { organizerName?: string }) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(strip(body))) {
      fd.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    }
    const token = await getAuthToken();
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/connect/events/publish`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
    } catch (err) {
      throw new ApiError(err instanceof Error ? err.message : 'Network error', 0, null);
    }
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      const message =
        (d && typeof d === 'object' && 'message' in d ? String((d as { message: unknown }).message) : null) ??
        `Request failed (${res.status})`;
      throw new ApiError(message, res.status, d);
    }
    return res.json().catch(() => null);
  },
  setEventLive: (id: string, isLive: boolean) =>
    api.patch(`connect/events/${id}/live`, { isLive }),
  async setEventGoing(id: string, going: boolean): Promise<EventGoingResponse> {
    const payload = (await api.patch(`connect/events/${id}/going`, { going })) as Raw;
    const rawEvent = payload?.event as Raw | undefined;
    const event = rawEvent ? mapEvent(rawEvent) : null;
    return {
      event,
      isGoing: payload?.isGoing === true,
      registrationCount: num(payload?.registrationCount),
      changed: payload?.changed === true,
    };
  },

  /** Jobs publish via draft → update → publish. Returns the new job id. */
  async createJob(body: JobDraft): Promise<{ id: string }> {
    const draft = (await api.post<Raw>('connect/jobs/drafts', {
      visibility: 'public',
      hiringStatus: 'open',
    })) as Raw;
    const inner = (draft.draft ?? draft.job ?? draft) as Raw;
    const draftId = String(inner._id ?? inner.id ?? '');
    if (draftId) {
      await api.patch(`connect/jobs/drafts/${draftId}`, strip(body));
      await api.post('connect/jobs/publish', { draftId });
    }
    return { id: draftId };
  },

  async jobApplications(id: string): Promise<JobApplicant[]> {
    return unwrap(await api.get(`connect/jobs/${id}/applications`)).map(mapApplicant);
  },

  /** Submit a job application as multipart so an optional résumé file can be attached. */
  async applyToJob(id: string, body: JobApplication, resume?: File | null) {
    const fd = new FormData();
    fd.append('name', body.name);
    fd.append('email', body.email);
    fd.append('phone', body.phone);
    fd.append('location', body.location);
    if (body.testimony) fd.append('testimony', body.testimony);
    fd.append('consentAccepted', String(body.consentAccepted));
    if (resume) fd.append('resumeFile', resume);

    const token = await getAuthToken();
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/connect/jobs/${id}/apply`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
    } catch (err) {
      throw new ApiError(err instanceof Error ? err.message : 'Network error', 0, null);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message =
        (data && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : null) ?? `Request failed (${res.status})`;
      throw new ApiError(message, res.status, data);
    }
    return res.json().catch(() => null);
  },
  trackEvent: (
    id: string,
    eventType: 'publish' | 'detail_open' | 'detail_view' | 'manage_view',
  ) => api.post(`connect/events/${id}/telemetry`, { eventType }).catch(() => {}),
};

/* ============================ Mock fallback ============================ */
const SCENE = (id: string) => `https://picsum.photos/seed/${id}/900/600`;

export const CONNECT_EVENTS_MOCK: ConnectEvent[] = [
  {
    id: 'e1',
    title: 'City Worship Night',
    category: 'Worship',
    image: SCENE('worship-night'),
    organizerName: 'Hillside Community Church',
    organizerRole: 'Host Church',
    dateLabel: 'Fri, May 30 · 7:00 PM',
    isOnline: false,
    venueName: 'Hillside Auditorium',
    address: 'Austin, TX',
    locationLabel: 'Hillside Auditorium',
    description:
      'An evening of unified worship across the city. Doors open at 6:30. Come expectant — let’s lift His name together.',
    attendees: 312,
    ticketType: 'free',
    tags: ['Worship', 'All ages'],
  },
  {
    id: 'e2',
    title: 'Downtown Meal Outreach',
    category: 'Outreach',
    image: SCENE('outreach'),
    organizerName: 'Mercy House Ministries',
    organizerRole: 'Host Ministry',
    dateLabel: 'Sat, May 31 · 5:30 PM',
    isOnline: false,
    venueName: '6th & Congress',
    address: 'Austin, TX',
    locationLabel: '6th & Congress',
    description: 'Serving hot meals and prayer downtown. Volunteers welcome — bring a friend.',
    attendees: 64,
    ticketType: 'free',
    tags: ['Serve', 'Outreach'],
  },
  {
    id: 'e3',
    title: 'Young Adults Online Bible Study',
    category: 'Bible Study',
    image: SCENE('young-adults'),
    organizerName: 'Grace Fellowship',
    organizerRole: 'Host Church',
    dateLabel: 'Sun, Jun 1 · 6:00 PM',
    isOnline: true,
    externalEventUrl: 'https://example.com/join',
    locationLabel: 'Online event',
    description: 'Weekly study in the book of Romans for young adults. Join from anywhere.',
    attendees: 158,
    ticketType: 'free',
    tags: ['Young Adults', 'Online'],
  },
];

export const CONNECT_JOBS_MOCK: ConnectJob[] = [
  {
    id: 's1',
    title: 'Kids Ministry Coordinator',
    organizationName: 'Hillside Community Church',
    denomination: 'Non-denominational',
    sector: 'Children & Family',
    opportunityType: 'Full-time',
    address: 'Austin, TX',
    locationLabel: 'Austin, TX',
    description:
      'Lead our growing kids ministry — disciple children and equip volunteers across weekend services.',
    requirements: ['2+ years in kids ministry', 'Background check', 'Heart for discipleship'],
    compensationLabel: '$48,000/yr',
    applicationMethods: ['in_app'],
    hiringStatus: 'open',
    applicantCount: 12,
  },
  {
    id: 's2',
    title: 'Worship Sound Engineer',
    organizationName: 'Grace Fellowship',
    denomination: 'Baptist',
    sector: 'Worship & Production',
    opportunityType: 'Part-time',
    address: 'Round Rock, TX',
    locationLabel: 'Round Rock, TX',
    description: 'Run front-of-house for weekend services and special events.',
    requirements: ['Live sound experience', 'Available Sundays'],
    compensationLabel: '$28/hr',
    applicationMethods: ['in_app', 'external_link'],
    applicationUrl: 'https://example.com/apply',
    hiringStatus: 'open',
    applicantCount: 5,
  },
  {
    id: 's3',
    title: 'Outreach Volunteer',
    organizationName: 'Mercy House Ministries',
    denomination: 'Non-denominational',
    sector: 'Community Outreach',
    opportunityType: 'Volunteer',
    address: 'Austin, TX',
    locationLabel: 'Austin, TX',
    description: 'Serve weekly at our downtown meal outreach. Flexible hours.',
    requirements: ['Servant heart'],
    compensationLabel: undefined,
    applicationMethods: ['in_app'],
    hiringStatus: 'open',
    applicantCount: 31,
  },
];

export const CONNECT_ORGS_MOCK: ConnectOrg[] = [
  {
    id: 'o1',
    title: 'Hillside Community Church',
    address: 'Austin, TX',
    avatar: 'https://i.pravatar.cc/200?u=hillside',
    organizationTypeLabel: 'Church',
    churchTypeLabel: 'Non-denominational',
    subtitle: 'Church · Non-denominational',
    distanceLabel: '2.4 mi',
  },
  {
    id: 'o2',
    title: 'Mercy House Ministries',
    address: 'Austin, TX',
    avatar: 'https://i.pravatar.cc/200?u=mercy',
    organizationTypeLabel: 'Non-Profit',
    churchTypeLabel: '',
    subtitle: 'Non-Profit',
    distanceLabel: '3.1 mi',
  },
  {
    id: 'o3',
    title: 'Grace Fellowship',
    address: 'Round Rock, TX',
    avatar: 'https://i.pravatar.cc/200?u=grace',
    organizationTypeLabel: 'Church',
    churchTypeLabel: 'Baptist',
    subtitle: 'Church · Baptist',
    distanceLabel: '8.0 mi',
  },
];
