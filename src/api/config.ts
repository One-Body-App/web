/** Base URL for the One Body NestJS API. Override via VITE_API_BASE_URL. */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'https://stagingapi.onebodyapp.com/api'
).replace(/\/+$/, '');
