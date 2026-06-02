// Web inbox notification model. Mirrors the mobile `InboxNotification` minus the push-only fields
// (web has no FCM/AsyncStorage queue), so every web notification is server-sourced.

export type NotificationKind = 'reaction' | 'comment' | 'follow' | 'prayer' | 'mention';

export interface InboxNotification {
  /** Stable list key, `server:<sourceId>`. */
  id: string;
  /** Raw API `_id` used for read/delete mutations. */
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  url?: string;
  iconUrl?: string;
  campaignId?: string;
  notificationType?: string;
  notificationSource?: string;
  actorId?: string;
  /** Derived enum, only used to pick the small badge icon. */
  kind: NotificationKind;
  data?: Record<string, unknown>;
}
