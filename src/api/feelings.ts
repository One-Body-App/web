// Feeling picker data for the composer. Mirrors the emoji+label shape of
// FULL_REACTION_PICKER_ITEMS (see ./reactions.ts) and reuses the same twemoji
// base so feeling glyphs render consistently with post reactions. Each entry
// pairs an emoji with its name so the chosen feeling carries both.
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@14.0.2/assets/72x72';

export interface FeelingItem {
  id: string;
  label: string;
  emoji: string;
  iconUrl: string;
}

export const FEELING_ITEMS: FeelingItem[] = [
  { id: 'happy', label: 'happy', emoji: '😊', iconUrl: `${TWEMOJI_BASE}/1f60a.png` },
  { id: 'blessed', label: 'blessed', emoji: '😇', iconUrl: `${TWEMOJI_BASE}/1f607.png` },
  { id: 'grateful', label: 'grateful', emoji: '🙏', iconUrl: `${TWEMOJI_BASE}/1f64f.png` },
  { id: 'loved', label: 'loved', emoji: '🥰', iconUrl: `${TWEMOJI_BASE}/1f970.png` },
  { id: 'joyful', label: 'joyful', emoji: '😄', iconUrl: `${TWEMOJI_BASE}/1f604.png` },
  { id: 'peaceful', label: 'peaceful', emoji: '😌', iconUrl: `${TWEMOJI_BASE}/1f60c.png` },
  { id: 'hopeful', label: 'hopeful', emoji: '🤞', iconUrl: `${TWEMOJI_BASE}/1f91e.png` },
  { id: 'excited', label: 'excited', emoji: '🤩', iconUrl: `${TWEMOJI_BASE}/1f929.png` },
  { id: 'thankful', label: 'thankful', emoji: '🙌', iconUrl: `${TWEMOJI_BASE}/1f64c.png` },
  { id: 'encouraged', label: 'encouraged', emoji: '💪', iconUrl: `${TWEMOJI_BASE}/1f4aa.png` },
  { id: 'sad', label: 'sad', emoji: '😢', iconUrl: `${TWEMOJI_BASE}/1f622.png` },
  { id: 'anxious', label: 'anxious', emoji: '😰', iconUrl: `${TWEMOJI_BASE}/1f630.png` },
];

export const getFeelingItem = (id?: string | null): FeelingItem | undefined =>
  id ? FEELING_ITEMS.find((feeling) => feeling.id === id) : undefined;
