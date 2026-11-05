import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BusinessProfile,
  Customer,
  Debt,
  Expense,
  Invoice,
  Product,
  Sale,
  StoreData,
  SyncStatus,
  UserProfile
} from '../types';
import {
  clearOfflineQueue,
  enqueueOfflineMutation,
  loadBusiness,
  loadLastSync,
  loadOfflineQueue,
  loadProfile,
  loadStore,
  saveBusiness,
  saveLastSync,
  saveProfile,
  saveStore,
  type QueuedOfflineMutation
} from './storage';
import { api } from './api';

const emptyStore: StoreData = {
  products: [],
  sales: [],
  expenses: [],
  debts: [],
  customers: [],
  invoices: []
};

function normalizeStore(raw?: Partial<StoreData> | null): StoreData {
  return {
    products: Array.isArray(raw?.products) ? raw.products : [],
    sales: Array.isArray(raw?.sales) ? raw.sales : [],
    expenses: Array.isArray(raw?.expenses) ? raw.expenses : [],
    debts: Array.isArray(raw?.debts) ? raw.debts : [],
    customers: Array.isArray(raw?.customers) ? raw.customers : [],
    invoices: Array.isArray(raw?.invoices) ? raw.invoices : []
  };
}

function hasAnyRecords(data: StoreData) {
  return Object.values(data).some(
    value => Array.isArray(value) && value.length > 0
  );
}

function mergeById<T extends { id: string }>(
  localItems: T[],
  remoteItems: T[]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const item of [...localItems, ...remoteItems]) {
    if (item && typeof item.id === 'string' && !seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

function mergeStores(local: StoreData, remote: StoreData): StoreData {
  return {
    products: mergeById(local.products, remote.products),
    sales: mergeById(local.sales, remote.sales),
    expenses: mergeById(local.expenses, remote.expenses),
    debts: mergeById(local.debts, remote.debts),
    customers: mergeById(local.customers, remote.customers),
    invoices: mergeById(local.invoices, remote.invoices)
  };
}

export function useStore(uid: string) {
  const [data, setData] = useState<StoreData>(() =>
    uid ? normalizeStore(loadStore(uid)) : emptyStore
  );
  const [profile, setProfileState] = useState<UserProfile | null>(() =>
    uid ? loadProfile(uid) : null
  );
  const [business, setBusinessState] = useState<BusinessProfile | null>(() =>
    uid ? loadBusiness(uid) : null
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    navigator.onLine ? 'idle' : 'offline'
  );
  const [lastSync, setLastSync] = useState<string | null>(() =>
    uid ? loadLastSync(uid) : null
  );
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() =>
    uid ? loadOfflineQueue(uid).length : 0
  );
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const dataRef = useRef(data);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const loadedRef = useRef(false);
  const syncTimer = useRef<number | null>(null);
  const pendingCountRef = useRef(pendingOfflineCount);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    pendingCountRef.current = pendingOfflineCount;
  }, [pendingOfflineCount]);

  useEffect(() => {
    if (!syncToast) return;
    const timer = window.setTimeout(() => {
      setSyncToast(null);
    }, 5500);
    return () => window.clearTimeout(timer);
  }, [syncToast]);

  const dismissSyncToast = useCallback(() => {
    setSyncToast(null);
  }, []);

  const announceOfflineFlush = useCallback(
    (flushedCount: number) => {
      if (flushedCount <= 0) return;
      clearOfflineQueue(uid);
      setPendingOfflineCount(0);
      pendingCountRef.current = 0;
      setSyncToast(
        `Synced ${flushedCount} offline ${
          flushedCount === 1 ? 'record' : 'records'
        }`
      );
    },
    [uid]
  );

  useEffect(() => {
    if (!uid) {
      setData(emptyStore);
      setProfileState(null);
      setBusinessState(null);
      setPendingOfflineCount(0);
      pendingCountRef.current = 0;
      loadedRef.current = false;
      dirtyRef.current = false;
      return;
    }

    const local = normalizeStore(loadStore(uid));
    const existingQueue = loadOfflineQueue(uid);
    setData(local);
    dataRef.current = local;
    setProfileState(loadProfile(uid));
    setBusinessState(loadBusiness(uid));
    setLastSync(loadLastSync(uid));
    setPendingOfflineCount(existingQueue.length);
    pendingCountRef.current = existingQueue.length;
    dirtyRef.current = existingQueue.length > 0;
    loadedRef.current = false;

    void api
      .loadStore()
      .then(async remote => {
        versionRef.current = remote.version || 0;
        const remoteData = normalizeStore(remote.data);

        if (dirtyRef.current || pendingCountRef.current > 0) {
          // Trader added records offline before initial fetch completed; merge and flush
          const flushedCount = pendingCountRef.current;
          const merged = mergeStores(dataRef.current, remoteData);
          setData(merged);
          dataRef.current = merged;
          saveStore(uid, merged);
          const saved = await api.saveStore(merged, versionRef.current);
          versionRef.current = saved.version;
          dirtyRef.current = false;
          if (flushedCount > 0) {
            announceOfflineFlush(flushedCount);
          }
        } else if (remote.version > 0 || hasAnyRecords(remoteData)) {
          setData(remoteData);
          dataRef.current = remoteData;
          saveStore(uid, remoteData);
        } else if (hasAnyRecords(local)) {
          const saved = await api.saveStore(local, 0);
          versionRef.current = saved.version;
        }

        const now = remote.updatedAt || new Date().toISOString();
        setLastSync(now);
        saveLastSync(uid, now);
        setSyncStatus('synced');
      })
      .catch(() => setSyncStatus(navigator.onLine ? 'error' : 'offline'))
      .finally(() => {
        loadedRef.current = true;
      });
  }, [announceOfflineFlush, uid]);

  useEffect(() => {
    if (!uid) return;
    saveStore(uid, data);
    if (!loadedRef.current || !dirtyRef.current || !navigator.onLine) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      const flushedCount = pendingCountRef.current;
      setSyncStatus('syncing');
      void api
        .saveStore(dataRef.current, versionRef.current)
        .then(result => {
          versionRef.current = result.version;
          if (result.data && !dirtyRef.current) {
            const mergedRemote = normalizeStore(result.data);
            setData(mergedRemote);
            dataRef.current = mergedRemote;
            saveStore(uid, mergedRemote);
          }
          dirtyRef.current = false;
          if (flushedCount > 0) {
            announceOfflineFlush(flushedCount);
          }
          const now = result.updatedAt || new Date().toISOString();
          setLastSync(now);
          saveLastSync(uid, now);
          setSyncStatus('synced');
        })
        .catch(() => setSyncStatus(navigator.onLine ? 'error' : 'offline'));
    }, 450);
    return () => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, [announceOfflineFlush, uid, data]);

  useEffect(() => {
    if (!uid) return;
    const interval = window.setInterval(() => {
      if (!navigator.onLine || dirtyRef.current) return;
      void api
        .loadStore()
        .then(remote => {
          if ((remote.version || 0) > versionRef.current) {
            versionRef.current = remote.version;
            const normalized = normalizeStore(remote.data);
            setData(normalized);
            dataRef.current = normalized;
            saveStore(uid, normalized);
            const now = remote.updatedAt || new Date().toISOString();
            setLastSync(now);
            saveLastSync(uid, now);
            setSyncStatus('synced');
          }
        })
        .catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [uid]);

  async function syncNow() {
    if (!uid) return;
    if (!navigator.onLine) {
      throw new Error(
        'You are offline. OjaFlow will sync when your connection returns.'
      );
    }
    const flushedCount = pendingCountRef.current;
    setSyncStatus('syncing');
    const result = await api.saveStore(dataRef.current, versionRef.current);
    versionRef.current = result.version;
    if (result.data) {
      const mergedRemote = normalizeStore(result.data);
      setData(mergedRemote);
      dataRef.current = mergedRemote;
      saveStore(uid, mergedRemote);
    }
    dirtyRef.current = false;
    if (flushedCount > 0) {
      announceOfflineFlush(flushedCount);
    }
    const now = result.updatedAt || new Date().toISOString();
    setLastSync(now);
    saveLastSync(uid, now);
    setSyncStatus('synced');
  }

  useEffect(() => {
    const online = () => {
      if (dirtyRef.current || pendingCountRef.current > 0) {
        void syncNow().catch(() => {
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
        });
      } else {
        setSyncStatus('synced');
      }
    };
    const offline = () => setSyncStatus('offline');
    const flushOnHide = () => {
      if (
        document.visibilityState === 'hidden' &&
        (dirtyRef.current || pendingCountRef.current > 0) &&
        navigator.onLine
      ) {
        void syncNow().catch(() => undefined);
      }
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', flushOnHide);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', flushOnHide);
    };
  });

  function mutate(
    updater: (current: StoreData) => StoreData,
    offlineMeta?: { kind: QueuedOfflineMutation['kind']; id: string }
  ) {
    dirtyRef.current = true;
    if (!navigator.onLine || syncStatus === 'offline' || syncStatus === 'error') {
      const nextCount = enqueueOfflineMutation(
        uid,
        offlineMeta?.kind || 'sale',
        offlineMeta?.id || `${Date.now()}`
      );
      setPendingOfflineCount(nextCount);
      pendingCountRef.current = nextCount;
      setSyncStatus('offline');
    }
    setData(current => updater(current));
  }

  const actions = useMemo(
    () => ({
      addProduct: (item: Product) =>
        mutate(
          current => ({ ...current, products: [item, ...current.products] }),
          { kind: 'product', id: item.id }
        ),
      addSale: (item: Sale) =>
        mutate(
          current => ({
            ...current,
            sales: [item, ...current.sales],
            products: current.products.map(product =>
              product.name.toLowerCase() === item.itemName.toLowerCase()
                ? {
                    ...product,
                    stock: Math.max(0, product.stock - item.quantity)
                  }
                : product
            )
          }),
          { kind: 'sale', id: item.id }
        ),
      addExpense: (item: Expense) =>
        mutate(
          current => ({ ...current, expenses: [item, ...current.expenses] }),
          { kind: 'expense', id: item.id }
        ),
      addDebt: (item: Debt) =>
        mutate(
          current => ({ ...current, debts: [item, ...current.debts] }),
          { kind: 'debt', id: item.id }
        ),
      addCustomer: (item: Customer) =>
        mutate(
          current => ({ ...current, customers: [item, ...current.customers] }),
          { kind: 'customer', id: item.id }
        ),
      updateCustomer: (item: Customer) =>
        mutate(
          current => ({
            ...current,
            customers: current.customers.map(customer =>
              customer.id === item.id ? item : customer
            )
          }),
          { kind: 'customer', id: item.id }
        ),
      addInvoice: (item: Invoice) =>
        mutate(
          current => ({ ...current, invoices: [item, ...current.invoices] }),
          { kind: 'invoice', id: item.id }
        ),
      updateInvoice: (item: Invoice) =>
        mutate(
          current => ({
            ...current,
            invoices: current.invoices.map(invoice =>
              invoice.id === item.id ? item : invoice
            )
          }),
          { kind: 'invoice', id: item.id }
        ),
      updateDebtPaid: (id: string, paid: number) =>
        mutate(
          current => ({
            ...current,
            debts: current.debts.map(debt =>
              debt.id === id
                ? { ...debt, paid: Math.min(debt.amount, Math.max(0, paid)) }
                : debt
            )
          }),
          { kind: 'debt', id }
        ),
      setProfile: (next: UserProfile) => {
        setProfileState(next);
        saveProfile(next);
      },
      setBusiness: (next: BusinessProfile) => {
        setBusinessState(next);
        saveBusiness(uid, next);
      },
      syncNow
    }),
    [syncStatus, uid]
  );

  return {
    data,
    profile,
    business,
    syncStatus,
    lastSync,
    pendingOfflineCount,
    syncToast,
    dismissSyncToast,
    actions
  };
}
