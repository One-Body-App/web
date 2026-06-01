export type FullReactionKind =
  | 'pray'
  | 'praise'
  | 'like'
  | 'love'
  | 'haha'
  | 'wow'
  | 'sad'
  | 'angry';

export const FULL_REACTION_KINDS: FullReactionKind[] = [
  'pray',
  'praise',
  'like',
  'love',
  'haha',
  'wow',
  'sad',
  'angry',
];

export type ReactionCounts = Record<FullReactionKind, number>;

export const createReactionCounts = (): ReactionCounts => ({
  pray: 0,
  praise: 0,
  like: 0,
  love: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
});

export const API_REACTION_BY_KIND: Record<FullReactionKind, string> = {
  pray: 'praying',
  praise: 'praise',
  like: 'like',
  love: 'love',
  haha: 'haha',
  wow: 'wow',
  sad: 'sad',
  angry: 'angry',
};

export const REACTION_KIND_BY_API: Record<string, FullReactionKind> = {
  praying: 'pray',
  pray: 'pray',
  praise: 'praise',
  happy: 'praise',
  like: 'like',
  love: 'love',
  haha: 'haha',
  wow: 'wow',
  sad: 'sad',
  angry: 'angry',
};

export const getReactionKindFromApi = (value?: string | null): FullReactionKind | undefined =>
  value ? REACTION_KIND_BY_API[value] : undefined;

export const getApiReactionType = (kind: FullReactionKind): string => API_REACTION_BY_KIND[kind];

export const getReactionTotal = (counts: ReactionCounts): number =>
  FULL_REACTION_KINDS.reduce((total, kind) => total + Math.max(0, counts[kind] ?? 0), 0);

export const patchReactionCounts = (
  counts: ReactionCounts,
  previous: FullReactionKind | null | undefined,
  next: FullReactionKind | null | undefined,
): ReactionCounts => {
  const patched = { ...counts };
  if (previous) {
    patched[previous] = Math.max(0, patched[previous] - 1);
  }
  if (next) {
    patched[next] += 1;
  }
  return patched;
};

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@14.0.2/assets/72x72';

export const FULL_REACTION_PICKER_ITEMS: Array<{
  kind: FullReactionKind;
  label: string;
  iconUrl: string;
  color: string;
}> = [
  { kind: 'pray', label: 'Pray', iconUrl: `${TWEMOJI_BASE}/1f64f.png`, color: 'var(--react-pray)' },
  { kind: 'praise', label: 'Praise', iconUrl: `${TWEMOJI_BASE}/1f64c.png`, color: 'var(--react-rejoice)' },
  { kind: 'like', label: 'Like', iconUrl: `${TWEMOJI_BASE}/1f44d.png`, color: 'var(--sapphire)' },
  { kind: 'love', label: 'Love', iconUrl: `${TWEMOJI_BASE}/2764.png`, color: 'var(--react-love)' },
  { kind: 'haha', label: 'Haha', iconUrl: `${TWEMOJI_BASE}/1f602.png`, color: '#d69e2e' },
  { kind: 'wow', label: 'Wow', iconUrl: `${TWEMOJI_BASE}/1f632.png`, color: '#d69e2e' },
  { kind: 'sad', label: 'Sad', iconUrl: `${TWEMOJI_BASE}/1f622.png`, color: '#4f6d77' },
  { kind: 'angry', label: 'Angry', iconUrl: `${TWEMOJI_BASE}/1f621.png`, color: '#c2410c' },
];

export const getReactionItem = (kind?: FullReactionKind | null) =>
  FULL_REACTION_PICKER_ITEMS.find((item) => item.kind === kind);
