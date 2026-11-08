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

const ACTIVE_UID_KEY = 'ojaflow:active_uid';
export const AUTH_SESSION_KEY = 'ojaflow:auth_session';

export interface PersistedAuthSession {
  uid: string;
  profile: UserProfile;
  business: BusinessProfile | null;
  accessToken?: string;
  csrfToken?: string;
  savedAt: string;
}

export function scheduleDeferredTask(
  callback: () => void,
  delayMs = 120
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let idleId: number | null = null;
  const win = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  const timerId = window.setTimeout(() => {
    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(callback, { timeout: 1500 });
    } else {
      callback();
    }
  }, delayMs);

  return () => {
    window.clearTimeout(timerId);
    if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
      win.cancelIdleCallback(idleId);
    }
  };
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
  try {
    const rawSession = localStorage.getItem(AUTH_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as PersistedAuthSession;
      if (parsed.uid === uid) {
        parsed.business = business;
        parsed.savedAt = new Date().toISOString();
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    // ignore storage parse error
  }
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
  localStorage.setItem(ACTIVE_UID_KEY, profile.uid);
  try {
    const rawSession = localStorage.getItem(AUTH_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as PersistedAuthSession;
      if (parsed.uid === profile.uid) {
        parsed.profile = profile;
        parsed.savedAt = new Date().toISOString();
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsed));
      }
    }
  } catch {
    // ignore storage parse error
  }
}

export function saveAuthSession(params: {
  profile: UserProfile;
  business?: BusinessProfile | null;
  accessToken?: string;
  csrfToken?: string;
}): PersistedAuthSession {
  const { profile, business, accessToken, csrfToken } = params;
  saveProfile(profile);
  const resolvedBusiness =
    business !== undefined ? business : loadBusiness(profile.uid);
  if (resolvedBusiness) {
    saveBusiness(profile.uid, resolvedBusiness);
  }

  const persistedToken =
    accessToken ||
    localStorage.getItem('ojaflow:session_token') ||
    sessionStorage.getItem('ojaflow:session_token') ||
    undefined;
  const persistedCsrf =
    csrfToken ||
    localStorage.getItem('ojaflow:csrf') ||
    sessionStorage.getItem('ojaflow:csrf') ||
    undefined;

  if (persistedToken) {
    localStorage.setItem('ojaflow:session_token', persistedToken);
    sessionStorage.setItem('ojaflow:session_token', persistedToken);
  }
  if (persistedCsrf) {
    localStorage.setItem('ojaflow:csrf', persistedCsrf);
    sessionStorage.setItem('ojaflow:csrf', persistedCsrf);
  }

  const snapshot: PersistedAuthSession = {
    uid: profile.uid,
    profile: {
      ...profile,
      preferredLanguage: profile.preferredLanguage || 'en'
    },
    business: resolvedBusiness ?? null,
    accessToken: persistedToken,
    csrfToken: persistedCsrf,
    savedAt: new Date().toISOString()
  };

  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(snapshot));
  localStorage.setItem(ACTIVE_UID_KEY, profile.uid);
  return snapshot;
}

export function loadAuthSession(): PersistedAuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedAuthSession>;
      if (parsed?.profile?.uid) {
        const uid = parsed.profile.uid;
        const latestProfile = loadProfile(uid) || {
          ...parsed.profile,
          preferredLanguage: parsed.profile.preferredLanguage || 'en'
        };
        const latestBusiness = loadBusiness(uid) ?? parsed.business ?? null;
        const token =
          localStorage.getItem('ojaflow:session_token') ||
          parsed.accessToken ||
          undefined;
        const csrf =
          localStorage.getItem('ojaflow:csrf') ||
          parsed.csrfToken ||
          undefined;

        if (token && !localStorage.getItem('ojaflow:session_token')) {
          localStorage.setItem('ojaflow:session_token', token);
        }
        if (csrf && !localStorage.getItem('ojaflow:csrf')) {
          localStorage.setItem('ojaflow:csrf', csrf);
        }
        localStorage.setItem(ACTIVE_UID_KEY, uid);

        return {
          uid,
          profile: latestProfile,
          business: latestBusiness,
          accessToken: token,
          csrfToken: csrf,
          savedAt: parsed.savedAt || new Date().toISOString()
        };
      }
    }

    // Fallback migration for existing cached profile in localStorage
    const activeUid = localStorage.getItem(ACTIVE_UID_KEY);
    if (activeUid) {
      const activeProfile = loadProfile(activeUid);
      if (activeProfile?.uid) {
        return saveAuthSession({
          profile: activeProfile,
          business: loadBusiness(activeProfile.uid)
        });
      }
    }

    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ojaflow:') && k.endsWith(':profile')) {
        const uid = k.slice('ojaflow:'.length, -':profile'.length);
        if (uid) {
          const found = loadProfile(uid);
          if (found?.uid) {
            return saveAuthSession({
              profile: found,
              business: loadBusiness(found.uid)
            });
          }
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function clearAuthSession(uid?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const activeUid = uid || localStorage.getItem(ACTIVE_UID_KEY) || '';
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(ACTIVE_UID_KEY);
    localStorage.removeItem('ojaflow:session_token');
    localStorage.removeItem('ojaflow:csrf');
    sessionStorage.removeItem('ojaflow:session_token');
    sessionStorage.removeItem('ojaflow:csrf');
    if (activeUid) {
      clearUserCache(activeUid);
    }
  } catch {
    // ignore storage cleanup errors
  }
}

export function loadCachedSession(): UserProfile | null {
  return loadAuthSession()?.profile ?? null;
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

  if (localStorage.getItem(ACTIVE_UID_KEY) === uid) {
    localStorage.removeItem(ACTIVE_UID_KEY);
  }

  try {
    const rawSession = localStorage.getItem(AUTH_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as Partial<PersistedAuthSession>;
      if (parsed.uid === uid) {
        localStorage.removeItem(AUTH_SESSION_KEY);
      }
    }
  } catch {
    // ignore storage parse error
  }

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