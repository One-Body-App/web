import { Bell, Bookmark, Compass, Home, MessageCircle, PlayCircle, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ConnectIcon } from '@/components/icons/ConnectIcon';
import { PrayerIcon } from '@/components/icons/PrayerIcon';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Show in the mobile bottom tab bar. */
  mobile?: boolean;
}

// Canonical nav order. Drives the mobile bottom tab bar and the mobile drawer;
// keep this aligned with the mobile app.
export const NAV_ITEMS: NavItem[] = [
  { to: '/home', label: 'Home', Icon: Home, mobile: true },
  { to: '/explore', label: 'Explore', Icon: Compass, mobile: true },
  { to: '/connect', label: 'Connect', Icon: ConnectIcon, mobile: true },
  { to: '/prayer', label: 'Pray', Icon: PrayerIcon },
  { to: '/watch', label: 'Watch', Icon: PlayCircle },
  { to: '/messages', label: 'Chat', Icon: MessageCircle, mobile: true },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
  { to: '/saved', label: 'Saved', Icon: Bookmark },
  { to: '/profile', label: 'Profile', Icon: User },
];

// Desktop sidebar shows the same items in a bespoke order. This is intentionally
// decoupled from NAV_ITEMS so it does not affect the mobile tab bar / drawer.
const SIDEBAR_ORDER = [
  '/home',
  '/prayer',
  '/watch',
  '/connect',
  '/explore',
  '/messages',
  '/notifications',
  '/saved',
  '/profile',
];
export const SIDEBAR_NAV_ITEMS: NavItem[] = [...NAV_ITEMS].sort(
  (a, b) => SIDEBAR_ORDER.indexOf(a.to) - SIDEBAR_ORDER.indexOf(b.to),
);
