# Onboarding Step 3: "Use my location" quick-detect — Design

## Goal

On Step 3 of onboarding ("Where do you call home?"), let users fill the City field
with one tap instead of typing. A location icon inside the City field detects the
user's position via the browser geolocation API, reverse-geocodes it to a readable
`City, State` string, and auto-fills the field.

## Scope

- Web app only (`web/`). No API contract changes; nothing touches the mobile app or admin.
- Single step component + one shared API helper + one small CSS rule.

## UX

- The City field gains a right-aligned icon button (uses the existing `TextField`
  `rightSlot`, the same slot the password toggle uses). Icon: `LocateFixed` (lucide-react).
- States:
  - **Idle:** location icon, `aria-label="Use my location"`.
  - **Detecting:** icon swaps to the existing `.spinner`; button disabled.
  - **Success:** field value set to the reverse-geocoded `City, State`; user can still edit.
  - **Error:** inline message via the field's `error` prop, e.g.
    "Couldn't detect your location — enter your city manually." Manual typing always works.
- Field stays optional; the existing skip-for-now behavior is unchanged.
- On success we only auto-fill the text. Coordinates are NOT captured here — the existing
  submit flow already re-geocodes the city string to coordinates in `OnboardingContext`,
  so behavior stays consistent whether the user typed or detected.

## API helper

Add `reverseGeocode(lng: number, lat: number): Promise<string | undefined>` to
`web/src/api/connect.ts`, mirroring the existing `geocodeAddress` (forward) helper:

1. **Mapbox** reverse endpoint using the existing `VITE_MAPBOX_PUBLIC_TOKEN`
   (`https://api.mapbox.com/search/geocode/v6/reverse?longitude=..&latitude=..`).
   Build `City, State` from the response's `place` + `region` context.
2. **Nominatim** reverse fallback
   (`https://nominatim.openstreetmap.org/reverse?format=json&lon=..&lat=..`).
   Build label from `address.city|town|village` + `address.state`.
3. Returns `undefined` if both fail or no place/region found. Errors are swallowed
   (try/catch), matching `geocodeAddress`.

## Component changes — `LocationStep.tsx`

- Add local `useState` for `detecting: boolean` and `error: string | null`. No `useEffect`
  (project rule) — all logic lives in the button's `onClick` handler.
- `handleDetect()`:
  - Guard: if `!navigator.geolocation`, set error and return.
  - `setDetecting(true)`, clear error.
  - `navigator.geolocation.getCurrentPosition(success, failure, { timeout: 10000 })`.
  - success → `await reverseGeocode(lng, lat)`; if a label comes back `setCity(label)`,
    else set error; finally `setDetecting(false)`.
  - failure → set a friendly error; `setDetecting(false)`.
- Pass `rightSlot={<button .../>}` and `error={error ?? undefined}` to `TextField`.

## CSS — `onboarding.css`

One rule for the in-field icon button (`.field__locate`) styled like the existing
`.field__toggle`: transparent, `--ink-3` color, hover to brand, disabled while detecting.

## Testing (manual)

- Allow geolocation → field auto-fills with `City, State`; value is editable.
- Deny permission → inline error shown; manual typing still works; Continue still proceeds.
- Mapbox token present vs. absent → Mapbox path, then Nominatim fallback.
- Mobile viewport (<=520px) → icon button reachable and not overlapping field text.

## Out of scope

- Typeahead/autocomplete suggestions while typing.
- Capturing precise coordinates at detect time (submit already geocodes the string).
- Any mobile-app (`app/`) changes.
