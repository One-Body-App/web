/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAPBOX_PUBLIC_TOKEN?: string;
  // Public Cloudflare Turnstile site key. Used by the standalone
  // <TurnstileGate> widget on non-Clerk surfaces. Auth screens get Turnstile
  // via Clerk Dashboard config and do not read this. The matching SECRET key
  // never lives in any web env - it goes on the NestJS API.
  readonly VITE_CLOUDFLARE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// SVG imports as URLs (Vite default)
declare module '*.svg' {
  const src: string;
  export default src;
}

declare module 'hls.js/light' {
  import Hls from 'hls.js';
  export default Hls;
}
