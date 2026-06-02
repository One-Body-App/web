# Web Memory

- Do not use `useEffect` or `React.useEffect` in the web app. Remove existing
  direct `useEffect` imports when touching a file, and prefer derived state,
  event handlers, `useSyncExternalStore`, callback refs, or approved local
  lifecycle helpers.
- Avoid ARIA role emulation that creates invalid role-child structures. Do not
  put command buttons inside `role="listbox"` unless they are real `option`
  widgets with the full keyboard model. Do not put buttons or live/status text
  as owned children of `role="list"`; use semantic `ul`/`li` and place
  `aria-live` messages outside the list.
- Edge DevTools/axe can flag ARIA boolean expressions as invalid even when they
  return string values, e.g. `aria-expanded={open ? 'true' : 'false'}` or
  `aria-pressed={active ? 'true' : 'false'}`. Prefer literal JSX branches like
  `aria-expanded="true"` / `aria-expanded="false"` and `aria-pressed="true"` /
  `aria-pressed="false"`; for `aria-hidden`, use `aria-hidden="true"` only on
  the hidden branch and omit the attribute when visible.
