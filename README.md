# One Body — Web

The desktop/web version of One Body: a React + Vite app with Clerk authentication.
A modern, mobile-first port of the One Body mobile app's screens and design language.

## Stack

- **React 18 + TypeScript + Vite**
- **Clerk** (`@clerk/clerk-react`) for authentication
- **React Router** for routing
- **Framer Motion** for animation
- **lucide-react** for icons
- Plain CSS with design tokens ported from the mobile app (`src/styles/theme.css`)

## Getting started

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

### Environment

Create `web/.env.local` with your Clerk publishable key:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
# optional — points the data layer at the shared NestJS API
VITE_API_BASE_URL=https://api.onebody...
# optional - enables Mapbox-backed Connect maps and geocoding
VITE_MAPBOX_PUBLIC_TOKEN=pk_xxxxxxxxxxxxxxxxxxxx
```

> **Preview mode:** if `VITE_CLERK_PUBLISHABLE_KEY` is absent, the app runs in a
> local demo session (no Clerk) so the full UI can be browsed without keys. As
> soon as a key is present, real Clerk auth takes over automatically.
> If `VITE_MAPBOX_PUBLIC_TOKEN` is absent, Connect map view falls back to
> OpenFreeMap/MapLibre and address geocoding falls back to Nominatim.

```bash
npm run build    # type-check (tsc -b) + production bundle
npm run preview  # serve the production build
```

## Architecture

```
src/
  auth/            Clerk integration + demo fallback (single AuthContext)
    AuthProvider   ClerkProvider when a key exists, demo session otherwise
    context.ts     useAuth() — uniform { isLoaded, isSignedIn, user, signOut }
    RequireAuth    route guard for authenticated screens
  layout/
    AppShell       responsive shell: mobile glass tab bar <-> desktop sidebar + discover rail
  components/      Logo, Avatar, PostCard (faith reactions), shared UI atoms
  screens/         Intro, SignIn, SignUp, Home, Explore, Connect, Messages,
                   Conversation, Notifications, Saved, Profile, CreatePost, Settings
  data/mock.ts     typed mock domain data — swap for real API (`../api`) calls
  styles/          theme.css (tokens) + global.css
```

### Design system

Tokens mirror the mobile app (`app/src/styles`): deep petrol-teal brand
(`#032F3C`), sapphire (`#126B87`), cyan accent (`#12D2D9`), Rubik (display) +
Open Sans (body), pill buttons and rounded cards. See `src/styles/theme.css`.

### Responsive layout

Mobile-first. Below 900px: a glass top bar + bottom tab bar with a center
"+" compose button. At 900px+: a left sidebar with a primary post button.
At 1200px+: an additional right "discover" rail (trending + suggested accounts).

## Real API integration (`src/api/`)

The app talks to the shared NestJS API (`../api`) using the Clerk session token.

- `config.ts` — base URL from `VITE_API_BASE_URL` (default staging).
- `token.ts` — bridges Clerk's `getToken()` to the plain client; `AuthProvider`
  registers it and calls `POST /auth/clerk/sync` once per sign-in to create/link
  the Mongo user.
- `client.ts` — fetch wrapper that attaches `Authorization: Bearer <clerk token>`.
- `endpoints.ts` — typed endpoints + mappers from the API's `SocialPost`/`User`
  shapes to the UI types (`OBPost`, `OBUser`, …).
- `useApi.ts` — `useApiQuery` (fetch-on-mount with **graceful fallback to mock
  data** in `src/data/mock.ts`) and `useApiMutation` (writes).

**Wired to live endpoints** (fall back to mock if the API is unreachable):
Home feed (`/user/get-following-feed/:type/:page`), reactions
(`PATCH /social/react`), create post (`POST /social/post`), Profile
(`/user/my-profile` + `/user/get-social/...`), Explore search
(`POST /user/search`) + suggestions + follow (`PATCH /user/subscribe/:id`),
Notifications (`/user/notifications` + read-all).

**Still on mock data:** Messages/chat (mobile uses a realtime socket —
`app/src/services/chat/socketClient.ts` — so web needs a socket client, not REST)
and Connect (events/serve endpoints not yet mapped).

### Going live (CORS + Clerk)

In dev, browser calls from `http://localhost:5173` to staging are **blocked by
CORS** (verified: the API returns no `access-control-allow-origin` for that
origin), so the app shows sample data + an "offline" banner. To enable live data,
the API must allow the web origin:

- Add the web origin(s) to the API's CORS allowlist (`api/src/main.ts`).
- Add the web origin(s) to `CLERK_AUTHORIZED_PARTIES` in the API env so Clerk
  token verification accepts them.

No web-app code change is needed once those are set.
