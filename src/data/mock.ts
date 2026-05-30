/* ---------------------------------------------------------------------------
 * Mock domain data for the One Body web app.
 * Shapes mirror the mobile app's concepts (posts, reactions, prayer, connect).
 * Swap these arrays for real API calls (api/) once Clerk-authed requests land.
 * ------------------------------------------------------------------------- */

export type ReactionKind = 'love' | 'pray' | 'rejoice';

export interface OBUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  verified?: boolean;
  kind?: 'creator' | 'church' | 'ministry' | 'member';
  bio?: string;
}

export interface OBPost {
  id: string;
  author: OBUser;
  createdAt: string; // relative label
  body: string;
  image?: string;
  verse?: { ref: string; text: string };
  reactions: Record<ReactionKind, number>;
  myReaction?: ReactionKind | null;
  comments: number;
  reposts: number;
  saved?: boolean;
  feeds: FeedType[];
}

export type FeedType = 'forYou' | 'connected' | 'read' | 'pray' | 'watch';

export const FEED_TABS: { key: FeedType; label: string }[] = [
  { key: 'forYou', label: 'For You' },
  { key: 'connected', label: 'Connected' },
  { key: 'read', label: 'Read' },
  { key: 'pray', label: 'Pray' },
  { key: 'watch', label: 'Watch' },
];

export const REACTIONS: { kind: ReactionKind; label: string; emoji: string; color: string }[] = [
  { kind: 'love', label: 'Love', emoji: '❤️', color: 'var(--react-love)' },
  { kind: 'pray', label: 'Pray', emoji: '🙏', color: 'var(--react-pray)' },
  { kind: 'rejoice', label: 'Rejoice', emoji: '🕊️', color: 'var(--react-rejoice)' },
];

const PORTRAIT = (seed: string, n = 400) => `https://i.pravatar.cc/${n}?u=${seed}`;
const SCENE = (id: string, w = 900, h = 600) => `https://picsum.photos/seed/${id}/${w}/${h}`;

export const users: Record<string, OBUser> = {
  maria: {
    id: 'u_maria',
    name: 'Maria Santos',
    username: 'mariasings',
    avatar: PORTRAIT('maria'),
    verified: true,
    kind: 'creator',
    bio: 'Worship leader & songwriter. Pointing hearts to Jesus 🎶',
  },
  grace: {
    id: 'demo-user',
    name: 'Grace Whitfield',
    username: 'gracew',
    avatar: '/brand/avatar2.png',
    kind: 'member',
    bio: 'Daughter of the King. Coffee, books & community.',
  },
  hillside: {
    id: 'u_hillside',
    name: 'Hillside Community Church',
    username: 'hillsidechurch',
    avatar: PORTRAIT('hillside'),
    verified: true,
    kind: 'church',
    bio: 'A family of believers in Austin, TX. Sundays 9 & 11am.',
  },
  david: {
    id: 'u_david',
    name: 'Pastor David Cole',
    username: 'pastordavid',
    avatar: PORTRAIT('david'),
    verified: true,
    kind: 'creator',
    bio: 'Teaching the Word, verse by verse.',
  },
  aisha: {
    id: 'u_aisha',
    name: 'Aisha Bello',
    username: 'aishab',
    avatar: PORTRAIT('aisha'),
    kind: 'member',
    bio: 'Missionary kid. Learning to trust Him daily.',
  },
  mercy: {
    id: 'u_mercy',
    name: 'Mercy House Ministries',
    username: 'mercyhouse',
    avatar: PORTRAIT('mercy'),
    verified: true,
    kind: 'ministry',
    bio: 'Serving the unhoused with dignity and love.',
  },
};

export const posts: OBPost[] = [
  {
    id: 'p1',
    author: users.maria,
    createdAt: '2h',
    body: 'New worship single drops Friday 🎶 Spent the morning in the studio just worshipping — He is so worthy. Can’t wait to share this one with the family.',
    image: SCENE('worship-studio'),
    reactions: { love: 1284, pray: 312, rejoice: 540 },
    myReaction: 'love',
    comments: 96,
    reposts: 41,
    feeds: ['forYou', 'connected', 'watch'],
  },
  {
    id: 'p2',
    author: users.david,
    createdAt: '4h',
    body: 'Reminder for today:',
    verse: {
      ref: 'Philippians 4:6–7',
      text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.',
    },
    reactions: { love: 902, pray: 488, rejoice: 233 },
    myReaction: null,
    comments: 54,
    reposts: 120,
    saved: true,
    feeds: ['forYou', 'read', 'pray'],
  },
  {
    id: 'p3',
    author: users.aisha,
    createdAt: '6h',
    body: 'Please pray for my dad’s surgery tomorrow morning. Believing for a steady hand on the surgeon and complete healing. Thank you, family 🙏',
    reactions: { love: 210, pray: 1840, rejoice: 64 },
    myReaction: 'pray',
    comments: 312,
    reposts: 8,
    feeds: ['forYou', 'pray', 'connected'],
  },
  {
    id: 'p4',
    author: users.hillside,
    createdAt: '9h',
    body: 'What a Sunday! 47 people gave their lives to Christ at both services. Heaven is celebrating today 🎉 Welcome to the family!',
    image: SCENE('church-celebration'),
    reactions: { love: 2100, pray: 410, rejoice: 1620 },
    myReaction: 'rejoice',
    comments: 188,
    reposts: 95,
    feeds: ['forYou', 'connected', 'watch'],
  },
  {
    id: 'p5',
    author: users.mercy,
    createdAt: '14h',
    body: 'Tonight we served 240 hot meals downtown. To everyone who volunteered and gave — this is the Body of Christ in motion. There’s room for more hands this weekend.',
    image: SCENE('serving-meals'),
    reactions: { love: 760, pray: 190, rejoice: 410 },
    myReaction: null,
    comments: 42,
    reposts: 67,
    feeds: ['forYou', 'connected'],
  },
];

/* -------------------------------- Explore -------------------------------- */

export const trendingTopics = [
  { tag: 'Worship', posts: '128k', hot: true },
  { tag: 'Prayer', posts: '96k', hot: true },
  { tag: 'Testimony', posts: '54k' },
  { tag: 'BibleStudy', posts: '47k' },
  { tag: 'Missions', posts: '31k' },
  { tag: 'YoungAdults', posts: '28k' },
  { tag: 'Marriage', posts: '22k', hot: true },
  { tag: 'Healing', posts: '19k' },
  { tag: 'Gratitude', posts: '17k' },
  { tag: 'Discipleship', posts: '12k' },
];

export const suggestedAccounts: OBUser[] = [
  users.maria,
  users.david,
  users.hillside,
  users.mercy,
];

/* -------------------------------- Connect -------------------------------- */

export interface ConnectEvent {
  id: string;
  title: string;
  host: string;
  date: string;
  location: string;
  distance: string;
  image: string;
  category: 'Service' | 'Conference' | 'Outreach' | 'Youth' | 'Worship';
  attendees: number;
}

export const connectEvents: ConnectEvent[] = [
  {
    id: 'e1',
    title: 'City Worship Night',
    host: 'Hillside Community Church',
    date: 'Fri, May 30 · 7:00 PM',
    location: 'Austin, TX',
    distance: '2.4 mi',
    image: SCENE('worship-night'),
    category: 'Worship',
    attendees: 312,
  },
  {
    id: 'e2',
    title: 'Downtown Meal Outreach',
    host: 'Mercy House Ministries',
    date: 'Sat, May 31 · 5:30 PM',
    location: '6th & Congress',
    distance: '3.1 mi',
    image: SCENE('outreach'),
    category: 'Outreach',
    attendees: 64,
  },
  {
    id: 'e3',
    title: 'Young Adults Summer Kickoff',
    host: 'Grace Fellowship',
    date: 'Sun, Jun 1 · 6:00 PM',
    location: 'Zilker Park',
    distance: '4.8 mi',
    image: SCENE('young-adults'),
    category: 'Youth',
    attendees: 158,
  },
];

export interface ServeRole {
  id: string;
  title: string;
  org: string;
  type: 'Volunteer' | 'Part-time' | 'Full-time';
  location: string;
  image: string;
}

export const serveRoles: ServeRole[] = [
  {
    id: 's1',
    title: 'Kids Ministry Volunteer',
    org: 'Hillside Community Church',
    type: 'Volunteer',
    location: 'Austin, TX',
    image: SCENE('kids-ministry'),
  },
  {
    id: 's2',
    title: 'Worship Sound Engineer',
    org: 'Grace Fellowship',
    type: 'Part-time',
    location: 'Round Rock, TX',
    image: SCENE('sound'),
  },
  {
    id: 's3',
    title: 'Outreach Coordinator',
    org: 'Mercy House Ministries',
    type: 'Full-time',
    location: 'Austin, TX',
    image: SCENE('coordinator'),
  },
];

/* -------------------------------- Messages ------------------------------- */

export interface Conversation {
  id: string;
  user: OBUser;
  lastMessage: string;
  time: string;
  unread: number;
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
}

export const conversations: Conversation[] = [
  {
    id: 'c1',
    user: users.maria,
    lastMessage: 'Yes! Let’s lead worship together Sunday 🙌',
    time: '9:41 AM',
    unread: 2,
  },
  {
    id: 'c2',
    user: users.aisha,
    lastMessage: 'Thank you for praying — surgery went well 😭❤️',
    time: 'Yesterday',
    unread: 0,
  },
  {
    id: 'c3',
    user: users.david,
    lastMessage: 'The notes from Sunday’s message are attached.',
    time: 'Yesterday',
    unread: 0,
  },
  {
    id: 'c4',
    user: users.hillside,
    lastMessage: 'You’re confirmed for the City Worship Night!',
    time: 'Tue',
    unread: 0,
  },
];

export const sampleThread: ChatMessage[] = [
  { id: 'm1', fromMe: false, text: 'Hey Grace! Are you free to lead worship this Sunday?', time: '9:30 AM' },
  { id: 'm2', fromMe: true, text: 'I’d love to 🙌 Which set are we doing?', time: '9:34 AM' },
  { id: 'm3', fromMe: false, text: 'Thinking “Goodness of God” into “Build My Life”.', time: '9:36 AM' },
  { id: 'm4', fromMe: true, text: 'Perfect keys for me. Let’s run it Thursday?', time: '9:38 AM' },
  { id: 'm5', fromMe: false, text: 'Yes! Let’s lead worship together Sunday 🙌', time: '9:41 AM' },
];

/* ------------------------------ Notifications ---------------------------- */

export interface OBNotification {
  id: string;
  user: OBUser;
  kind: 'reaction' | 'comment' | 'follow' | 'prayer' | 'mention';
  text: string;
  time: string;
  unread: boolean;
}

export const notifications: OBNotification[] = [
  { id: 'n1', user: users.maria, kind: 'reaction', text: 'loved your post', time: '5m', unread: true },
  { id: 'n2', user: users.david, kind: 'follow', text: 'started following you', time: '1h', unread: true },
  {
    id: 'n3',
    user: users.aisha,
    kind: 'prayer',
    text: 'is praying for your request',
    time: '3h',
    unread: true,
  },
  {
    id: 'n4',
    user: users.hillside,
    kind: 'comment',
    text: 'commented: “Amen! See you Sunday 🙌”',
    time: '6h',
    unread: false,
  },
  { id: 'n5', user: users.mercy, kind: 'mention', text: 'mentioned you in a post', time: '1d', unread: false },
];

/* ------------------------------ Profile stats ---------------------------- */

export const profilePosts = Array.from({ length: 9 }).map((_, i) => ({
  id: `pp${i}`,
  image: SCENE(`profile-grid-${i}`, 500, 500),
}));
