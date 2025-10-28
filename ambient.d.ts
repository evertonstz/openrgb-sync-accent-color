import '@girs/gjs';
import '@girs/gjs/dom';
import '@girs/gnome-shell/ambient';
import '@girs/gnome-shell/extensions/global';
import '@girs/gio-2.0';
import '@girs/glib-2.0';

declare module 'resource:///org/gnome/shell/ui/main.js' {
  interface MessageTrayAPI {
    add(source: unknown): void;
  }
  const messageTray: MessageTrayAPI;
  function notify(title: string, body?: string): void;
  export { messageTray, notify };
}

declare module 'resource:///org/gnome/shell/ui/messageTray.js' {
  type UnknownNotification = unknown;
  class Source {
    constructor(title?: string);
    showNotification(notification: UnknownNotification): void;
    notify(notification: UnknownNotification): void;
    addNotification(notification: UnknownNotification): void;
  }
  class Notification {
    constructor(source: Source, title: string, body?: string);
    setTransient?(t: boolean): void;
    setUrgency?(u: unknown): void;
    isTransient?: () => boolean;
    urgency?: unknown;
  }
  const Urgency: { LOW: unknown; NORMAL: unknown; HIGH: unknown };
  export { Source, Notification, Urgency };
}
