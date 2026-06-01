# Web Memory

- Do not use `useEffect` or `React.useEffect` in the web app. Remove existing
  direct `useEffect` imports when touching a file, and prefer derived state,
  event handlers, `useSyncExternalStore`, callback refs, or approved local
  lifecycle helpers.
