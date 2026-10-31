// Add a new origin only after reviewing the integration that needs it.
const clerk = 'https://*.clerk.accounts.dev https://clerk.onebodyapp.com https://clerk.staging.onebodyapp.com';
export const browserCsp = [
  "default-src 'self'",
  `script-src 'self' ${clerk} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `connect-src 'self' https://*.onebodyapp.com wss://*.onebodyapp.com ${clerk} https://clerk-telemetry.com https://challenges.cloudflare.com https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://tiles.openfreemap.org https://*.digitaloceanspaces.com https://*.mux.com https://api.giphy.com`,
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: blob:",
  "worker-src 'self' blob:",
  `frame-src ${clerk} https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`,
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${clerk}`,
  'upgrade-insecure-requests',
].join('; ');
