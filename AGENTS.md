# Agent guidance — One Body web app

## Cross-Client Parity

Cross-check every change against the equivalent area in `../app/`. Web changes should follow the mobile app's established behavior where applicable, and mobile changes must verify whether the web app needs the same behavior. If the feature or equivalent surface does not exist in the other client, ask whether it should be added.

## Do not use React useEffect

Do not import or call `useEffect` / `React.useEffect` anywhere in the web app.
Prefer derived state, event handlers, external stores with `useSyncExternalStore`,
callback refs for DOM subscriptions/observers, and existing project hooks or
helpers that are already approved for lifecycle work.

When editing a file that already imports `useEffect`, remove it as part of the
change instead of adding more effect-based logic.

## ARIA boolean attributes must use literal JSX branches

React/TypeScript happily accepts `aria-expanded={someBool}`, but axe/aria
linters (Edge DevTools, axe-core, eslint-plugin-jsx-a11y) flag any
expression value as "Invalid ARIA attribute value" because they cannot
statically infer the runtime result. Edge can also flag string-returning
ternaries such as `aria-expanded={open ? 'true' : 'false'}` or
`aria-pressed={active ? 'true' : 'false'}` as `aria-expanded="{expression}"`
or `aria-pressed="{expression}"`. Prefer literal JSX branches:

```tsx
// Wrong — axe flags as Invalid ARIA attribute value
<button aria-expanded={isOpen}>...</button>
<button aria-expanded={isOpen ? 'true' : 'false'}>...</button>
<aside aria-hidden={!visible}>...</aside>
<button aria-pressed={selected === key}>...</button>
<button aria-pressed={selected ? 'true' : 'false'}>...</button>

// Correct
{isOpen ? <button aria-expanded="true">...</button> : <button aria-expanded="false">...</button>}
{visible ? <aside>...</aside> : <aside aria-hidden="true">...</aside>}
{selected ? <button aria-pressed="true">...</button> : <button aria-pressed="false">...</button>}
```

If Edge DevTools/axe reports a literal-looking JSX expression such as
`aria-expanded="{expression}"`, `aria-hidden="{expression}"`, or
`aria-pressed="{expression}"`, avoid the attribute expression entirely. Render
separate branches so the JSX contains a literal attribute such as
`aria-expanded="true"`, `aria-pressed="true"`, or `aria-hidden="true"`, and
omit the attribute when it is not needed.

Applies to every ARIA boolean attribute: `aria-expanded`, `aria-hidden`,
`aria-pressed`, `aria-selected`, `aria-checked`, `aria-busy`,
`aria-invalid`, `aria-modal`, `aria-disabled`, `aria-required`,
`aria-readonly`, `aria-grabbed`.

Canonical example in this repo: `src/screens/CreatePost.tsx` lines 220
and 234. When writing or editing JSX, audit every `aria-*` attribute in
the change before saving.

## ARIA roles must match their required child structure

Do not add ARIA collection/widget roles unless the element and its children
implement the required ARIA pattern. Edge DevTools/axe will flag errors such
as "Certain ARIA roles must contain particular children" when a role owns
children that are not allowed.

Common cases in this repo:

```tsx
// Wrong: listbox children must be option/group/presentation, not buttons.
<div role="listbox">
  <button type="button">Genesis</button>
</div>

// Correct: this is a group of command buttons, not a listbox.
<div aria-label="Bible books">
  <button type="button">Genesis</button>
</div>

// Wrong: role=list should own only listitem/group children.
<div role="list">
  <button type="button" aria-label="Remove" />
  <p role="status">Max items reached.</p>
</div>

// Correct: use semantic list markup, and keep live/status text outside it.
<>
  <ul aria-label="Selected media">
    <li>
      <button type="button" aria-label="Remove media" />
    </li>
  </ul>
  <p aria-live="polite">Max items reached.</p>
</>
```

Prefer native HTML semantics (`ul`/`li`, `dialog`, `button`, `nav`,
`fieldset`) over ARIA role emulation. Only use roles like `listbox`, `menu`,
`tablist`, `radiogroup`, or `status` when the required child roles and keyboard
interaction model are implemented. For ordinary button groups, use a plain
container with `aria-label`.
