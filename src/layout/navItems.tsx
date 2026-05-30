import { Bell, Bookmark, Compass, HandHeart, HeartHandshake, Home, MessageCircle, PlayCircle, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Show in the mobile bottom tab bar. */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/home', label: 'Home', Icon: Home, mobile: true },
  { to: '/explore', label: 'Explore', Icon: Compass, mobile: true },
  { to: '/connect', label: 'Connect', Icon: HeartHandshake, mobile: true },
  { to: '/prayer', label: 'Prayer', Icon: HandHeart },
  { to: '/watch', label: 'Watch', Icon: PlayCircle },
  { to: '/messages', label: 'Messages', Icon: MessageCircle, mobile: true },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
  { to: '/saved', label: 'Saved', Icon: Bookmark },
  { to: '/profile', label: 'Profile', Icon: User },
];
