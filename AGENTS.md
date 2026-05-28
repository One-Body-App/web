# Agent guidance — One Body web app

## ARIA boolean attributes must be string literals, not booleans

React/TypeScript happily accepts `aria-expanded={someBool}`, but axe/aria
linters (Edge DevTools, axe-core, eslint-plugin-jsx-a11y) flag any
expression value as "Invalid ARIA attribute value" because they cannot
statically infer the runtime result. Always stringify:

```tsx
// Wrong — axe flags as Invalid ARIA attribute value
<button aria-expanded={isOpen}>...</button>
<aside aria-hidden={!visible}>...</aside>
<button aria-pressed={selected === key}>...</button>

// Correct
<button aria-expanded={isOpen ? 'true' : 'false'}>...</button>
<aside aria-hidden={!visible ? 'true' : 'false'}>...</aside>
<button aria-pressed={selected === key ? 'true' : 'false'}>...</button>
```

Applies to every ARIA boolean attribute: `aria-expanded`, `aria-hidden`,
`aria-pressed`, `aria-selected`, `aria-checked`, `aria-busy`,
`aria-invalid`, `aria-modal`, `aria-disabled`, `aria-required`,
`aria-readonly`, `aria-grabbed`.

Canonical example in this repo: `src/screens/CreatePost.tsx` lines 220
and 234. When writing or editing JSX, audit every `aria-*` attribute in
the change before saving.
