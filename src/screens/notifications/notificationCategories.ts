// Ported verbatim from the mobile app (app/src/screens/notifications/notificationCategories.ts).
// Pure, framework-agnostic categorization so web and mobile classify notifications identically.

export type NotificationCategoryKey =
  | 'all'
  | 'tagged'
  | 'feed'
  | 'prayers'
  | 'blog_posts'
  | 'serve'
  | 'go';

export type NotificationCategoryInput = {
  title?: string;
  body?: string;
  notificationType?: string;
  notificationSource?: string;
  data?: Record<string, unknown>;
};

type CategoryMatcherKey = Exclude<NotificationCategoryKey, 'all'>;

const CATEGORY_PRIORITY: CategoryMatcherKey[] = [
  'tagged',
  'prayers',
  'blog_posts',
  'serve',
  'go',
  'feed',
];

const MATCHERS: Record<CategoryMatcherKey, RegExp> = {
  tagged: /\btag|mention|@/i,
  feed: /\bfeed|post|comment|like|reaction|share|campaign|activity|chat|watch|social/i,
  prayers: /\bprayer|pray|bless|intercession/i,
  blog_posts: /\bblog|rss|article|read|story/i,
  serve: /\bserve|service|volunteer|ministry|job|application/i,
  go: /\bgo\b|event|mission|missions|outreach/i,
};

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getPostTypeCategory = (value: unknown): CategoryMatcherKey | null => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'prayer') {
    return 'prayers';
  }

  if (normalized === 'rss') {
    return 'blog_posts';
  }

  if (normalized === 'social' || normalized === 'watch') {
    return 'feed';
  }

  return null;
};

const appendMatchedCategories = (
  input: string | undefined,
  categories: Set<CategoryMatcherKey>,
  includeFeed = true,
) => {
  if (!input) {
    return;
  }

  CATEGORY_PRIORITY.forEach((category) => {
    if (category === 'feed' && !includeFeed) {
      return;
    }

    if (MATCHERS[category].test(input)) {
      categories.add(category);
    }
  });
};

const toOrderedCategories = (categories: Set<CategoryMatcherKey>) =>
  CATEGORY_PRIORITY.filter((category) => categories.has(category));

export const getNotificationCategories = (
  input: NotificationCategoryInput,
): CategoryMatcherKey[] => {
  const metadataCategories = new Set<CategoryMatcherKey>();
  const textCategories = new Set<CategoryMatcherKey>();

  appendMatchedCategories(input.notificationType, metadataCategories);
  appendMatchedCategories(input.notificationSource, metadataCategories);

  const postTypeCategory = getPostTypeCategory(input.data?.postType);
  if (postTypeCategory) {
    metadataCategories.add(postTypeCategory);
  }

  appendMatchedCategories(input.title, textCategories);
  appendMatchedCategories(input.body, textCategories);

  const orderedMetadataCategories = toOrderedCategories(metadataCategories);
  if (!orderedMetadataCategories.length) {
    const orderedTextCategories = toOrderedCategories(textCategories);
    return orderedTextCategories.length ? orderedTextCategories : ['feed'];
  }

  if (orderedMetadataCategories.every((category) => category === 'feed')) {
    const orderedSpecificTextCategories = toOrderedCategories(textCategories).filter(
      (category) => category !== 'feed',
    );

    if (orderedSpecificTextCategories.length) {
      return [...orderedSpecificTextCategories, 'feed'];
    }
  }

  return orderedMetadataCategories;
};

export const getPrimaryNotificationCategory = (
  input: NotificationCategoryInput,
): CategoryMatcherKey => getNotificationCategories(input)[0] || 'feed';
