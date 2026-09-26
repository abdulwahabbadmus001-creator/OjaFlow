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
  localStorage.setItem(
    key(uid, 'store'),
    JSON.stringify(data)
  );
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