import type {
  BusinessProfile,
  NotificationPreferences,
  StoreData,
  UserProfile
} from '../types';

const emptyStore: StoreData = {
  products: [],
  sales: [],
  expenses: [],
  debts: [],
  customers: [],
  invoices: []
};

export const defaultNotifications: NotificationPreferences = {
  lowStock: true,
  debtReminders: true,
  dailySummary: false,
  syncProblems: true
};

function key(uid: string, name: string) {
  return `ojaflow:${uid}:${name}`;
}

export function loadStore(uid: string): StoreData {
  const raw = localStorage.getItem(key(uid, 'store'));

  if (!raw) {
    return structuredClone(emptyStore);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoreData>;

    return {
      ...structuredClone(emptyStore),
      ...parsed,
      invoices: parsed.invoices || []
    } as StoreData;
  } catch {
    return structuredClone(emptyStore);
  }
}

export function saveStore(uid: string, data: StoreData) {
  const k = key(uid, 'store');
  localStorage.setItem(
    k,
    JSON.stringify(data)
  );
  mirrorToIndexedDB(k, data);
}

export function loadBusiness(
  uid: string
): BusinessProfile | null {
  const raw = localStorage.getItem(
    key(uid, 'business')
  );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as BusinessProfile;
  } catch {
    return null;
  }
}

export function saveBusiness(
  uid: string,
  business: BusinessProfile
) {
  localStorage.setItem(
    key(uid, 'business'),
    JSON.stringify(business)
  );
}

export function loadProfile(
  uid: string
): UserProfile | null {
  const raw = localStorage.getItem(
    key(uid, 'profile')
  );

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as UserProfile;

    return {
      ...parsed,
      preferredLanguage:
        parsed.preferredLanguage || 'en'
    };
  } catch {
    return null;
  }
}

export function saveProfile(
  profile: UserProfile
) {
  localStorage.setItem(
    key(profile.uid, 'profile'),
    JSON.stringify(profile)
  );
}

export function loadNotifications(
  uid: string
): NotificationPreferences {
  const raw = localStorage.getItem(
    key(uid, 'notifications')
  );

  if (!raw) {
    return { ...defaultNotifications };
  }

  try {
    return {
      ...defaultNotifications,
      ...(JSON.parse(raw) as NotificationPreferences)
    };
  } catch {
    return { ...defaultNotifications };
  }
}

export function saveNotifications(
  uid: string,
  preferences: NotificationPreferences
) {
  localStorage.setItem(
    key(uid, 'notifications'),
    JSON.stringify(preferences)
  );
}

export interface QueuedOfflineMutation {
  id: string;
  kind: 'sale' | 'expense' | 'product' | 'debt' | 'customer' | 'invoice';
  queuedAt: string;
}

const IDB_NAME = 'ojaflow_offline_db';
const IDB_STORE = 'kv_cache';

function mirrorToIndexedDB(k: string, value: unknown): void {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, k);
        tx.oncomplete = () => db.close();
      } catch {
        // ignore IDB write error
      }
    };
  } catch {
    // ignore IDB open error
  }
}

export function loadOfflineQueue(uid: string): QueuedOfflineMutation[] {
  if (!uid) return [];
  const raw = localStorage.getItem(key(uid, 'offline-queue'));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedOfflineMutation[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineMutation(
  uid: string,
  kind: QueuedOfflineMutation['kind'],
  recordId: string
): number {
  if (!uid) return 0;
  const current = loadOfflineQueue(uid);
  const exists = current.some(item => item.id === recordId && item.kind === kind);
  const next: QueuedOfflineMutation[] = exists
    ? current
    : [
        ...current,
        {
          id: recordId,
          kind,
          queuedAt: new Date().toISOString()
        }
      ];
  const k = key(uid, 'offline-queue');
  localStorage.setItem(k, JSON.stringify(next));
  mirrorToIndexedDB(k, next);
  return next.length;
}

export function clearOfflineQueue(uid: string): void {
  if (!uid) return;
  const k = key(uid, 'offline-queue');
  localStorage.removeItem(k);
  mirrorToIndexedDB(k, []);
}

export function saveLastSync(
  uid: string,
  iso: string
) {
  localStorage.setItem(
    key(uid, 'last-sync'),
    iso
  );
}

export function loadLastSync(
  uid: string
): string | null {
  return localStorage.getItem(
    key(uid, 'last-sync')
  );
}

export function markCloudMigrated(
  uid: string,
  collectionName: string
) {
  localStorage.setItem(
    key(uid, `migrated:${collectionName}`),
    '1'
  );
}

export function cloudMigrationDone(
  uid: string,
  collectionName: string
): boolean {
  return (
    localStorage.getItem(
      key(uid, `migrated:${collectionName}`)
    ) === '1'
  );
}

export function clearUserCache(
  uid: string
) {
  const prefix = `ojaflow:${uid}:`;

  for (
    let i = localStorage.length - 1;
    i >= 0;
    i -= 1
  ) {
    const itemKey = localStorage.key(i);

    if (itemKey?.startsWith(prefix)) {
      localStorage.removeItem(itemKey);
    }
  }
}

export function clearAllUserCaches() {
  const preserve = new Set([
    'ojaflow:theme',
    'ojaflow:cookie-consent',
    'ojaflow:essential-storage-consent'
  ]);

  for (
    let i = localStorage.length - 1;
    i >= 0;
    i -= 1
  ) {
    const itemKey = localStorage.key(i);

    if (
      itemKey &&
      itemKey.startsWith('ojaflow:') &&
      !preserve.has(itemKey)
    ) {
      localStorage.removeItem(itemKey);
    }
  }
}