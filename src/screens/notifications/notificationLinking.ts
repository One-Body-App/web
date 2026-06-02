// Adapted from the mobile app (app/src/screens/notifications/notificationLinking.ts).
// The URL-parsing helpers are shared; the mobile `onebodyapp://` deep-link rewrite is replaced by
// `resolveNotificationWebRoute`, which maps a notification target to a React Router path (internal),
// an external URL (open in a new tab), or null (no destination -> no-op).

type NotificationPayloadData = Record<string, unknown>;

const ONEBODY_WEB_HOSTS = new Set([
  'app.onebodyapp.com',
  'www.onebodyapp.com',
  'onebodyapp.com',
  'auth.onebodyapp.com',
]);

// Post types the web app can route to (mirrors App.tsx `/post/:type/:id`).
const ROUTABLE_POST_TYPES = new Set(['social', 'prayer', 'watch', 'rss']);

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const tryParseUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const getPayloadString = (data: NotificationPayloadData | undefined, key: string) =>
  normalizeOptionalString(data?.[key]);

const normalizePostType = (value: unknown) => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return ROUTABLE_POST_TYPES.has(normalized) ? normalized : undefined;
};

export const isOneBodyDeepLinkCandidate = (value?: string | null) => {
  const parsed = tryParseUrl(value);
  if (!parsed) {
    return false;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol === 'onebodyapp:') {
    return true;
  }

  return (protocol === 'https:' || protocol === 'http:') && ONEBODY_WEB_HOSTS.has(parsed.host);
};

// Resolve the raw target URL/data the same way mobile does: explicit url, then nested payload keys,
// then a synthesized post deep link from postType/postId/commentId.
export const resolveNotificationTargetUrl = (input: {
  url?: string;
  data?: NotificationPayloadData;
}) => {
  const directUrl = normalizeOptionalString(input.url);
  if (directUrl) {
    return directUrl;
  }

  const nestedUrl =
    getPayloadString(input.data, 'url') ||
    getPayloadString(input.data, 'deepLink') ||
    getPayloadString(input.data, 'link');
  if (nestedUrl) {
    return nestedUrl;
  }

  const postType = normalizePostType(input.data?.postType);
  const postId = normalizeOptionalString(input.data?.postId);
  if (postType && postId) {
    const commentId = normalizeOptionalString(input.data?.commentId);
    return commentId ? `onebodyapp://post/${postType}/${postId}?commentId=${commentId}` : `onebodyapp://post/${postType}/${postId}`;
  }

  return undefined;
};

export type NotificationRoute =
  | { kind: 'internal'; to: string }
  | { kind: 'external'; url: string }
  | null;

// Turn a OneBody deep-link/web path like `post/social/123(?commentId=x)` into a web route.
const pathToWebRoute = (pathname: string, search: string): NotificationRoute => {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments[0] === 'post') {
    const type = normalizePostType(segments[1]);
    const id = normalizeOptionalString(segments[2]);
    if (type && id) {
      const params = new URLSearchParams(search);
      const commentId =
        normalizeOptionalString(params.get('commentId')) || normalizeOptionalString(segments[4]);
      const base = `/post/${type}/${id}`;
      return { kind: 'internal', to: commentId ? `${base}/c/${commentId}` : base };
    }
  }

  // OneBody destination we can't route to on web yet -> no-op (tap just marks the item read).
  // Notably, connection notifications deep-link to `profile/{id}`, but web has no public
  // `/profile/:id` route, so they intentionally fall through here until that route exists.
  return null;
};

// Decide where a notification tap should go on web.
export const resolveNotificationWebRoute = (input: {
  url?: string;
  data?: NotificationPayloadData;
}): NotificationRoute => {
  const targetUrl = resolveNotificationTargetUrl(input);
  if (!targetUrl) {
    return null;
  }

  const parsed = tryParseUrl(targetUrl);

  if (parsed?.protocol.toLowerCase() === 'onebodyapp:') {
    // onebodyapp://post/... -> host is the first path segment ("post").
    return pathToWebRoute(`${parsed.host}${parsed.pathname}`, parsed.search);
  }

  if (parsed && ONEBODY_WEB_HOSTS.has(parsed.host)) {
    return pathToWebRoute(parsed.pathname, parsed.search);
  }

  if (parsed && (parsed.protocol === 'https:' || parsed.protocol === 'http:')) {
    return { kind: 'external', url: targetUrl };
  }

  return null;
};
