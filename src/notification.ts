import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

/**
 * Notification urgency levels supported by GNOME Shell's MessageTray.
 */
export enum NotificationUrgency {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

interface NotificationOptions {
  body?: string;
  persistent?: boolean;
  urgency?: NotificationUrgency;
  iconName?: string;
}

function getUrgencyValue(urgency: string): number {
  const MT: any = MessageTray as any;
  const urgencyMap = MT.Urgency;
  if (!urgencyMap) return 0;
  const key = urgency.toUpperCase();
  return urgencyMap[key] ?? urgencyMap.LOW ?? 0;
}

function getExtensionIcon(): any {
  try {
    const ext = Extension.lookupByURL(import.meta.url);
    if (!ext) return null;
    const iconFile = ext.dir.get_child('resources').get_child('icon.svg');
    if (iconFile.query_exists(null)) {
      return new Gio.FileIcon({ file: iconFile });
    }
  } catch (e) {
    console.log('OpenRGB Accent Sync: Could not load extension icon:', e);
  }
  return null;
}

let notificationSource: any = null;

function getNotificationSource(): any {
  if (notificationSource) return notificationSource;

  const MT: any = MessageTray as any;

  try {
    notificationSource = new MT.Source({
      title: 'OpenRGB Accent Sync',
      iconName: 'preferences-system-symbolic',
    });
    notificationSource.connect('destroy', () => {
      notificationSource = null;
    });
    (Main as any).messageTray?.add(notificationSource);
    return notificationSource;
  } catch {
    try {
      notificationSource = new MT.Source('OpenRGB Accent Sync', 'preferences-system-symbolic');
      notificationSource.connect('destroy', () => {
        notificationSource = null;
      });
      (Main as any).messageTray?.add(notificationSource);
      return notificationSource;
    } catch (e) {
      console.warn('OpenRGB Accent Sync: Failed to create notification source:', e);
      return null;
    }
  }
}

/**
 * Show a GNOME Shell notification with persistence in notification history.
 * @param title Short title for the notification
 * @param options Optional configuration
 */
export function showExtensionNotification(title: string, options: NotificationOptions = {}): void {
  const { body = '', persistent = true, urgency = NotificationUrgency.LOW, iconName } = options;

  const source = getNotificationSource();
  if (!source) {
    try {
      (Main as any).notify(title, body);
    } catch {}
    return;
  }

  const MT: any = MessageTray as any;

  const notifParams: any = {
    source,
    title,
    body,
    isTransient: !persistent,
  };

  if (urgency !== NotificationUrgency.LOW) {
    notifParams.urgency = getUrgencyValue(urgency);
  }

  const gicon = getExtensionIcon();
  if (gicon) {
    notifParams.gicon = gicon;
  } else if (iconName) {
    notifParams.gicon = new Gio.ThemedIcon({ name: iconName });
  }

  if (persistent) {
    notifParams.resident = true;
  }

  try {
    const notification = new MT.Notification(notifParams);
    source.addNotification(notification);
  } catch (e) {
    console.warn('OpenRGB Accent Sync: Failed to show notification:', e);
    try {
      (Main as any).notify(title, body);
    } catch {}
  }
}
