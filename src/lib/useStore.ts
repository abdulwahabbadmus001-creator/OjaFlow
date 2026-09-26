import { useEffect, useMemo, useRef, useState } from 'react';
import type { BusinessProfile, Customer, Debt, Expense, Invoice, Product, Sale, StoreData, SyncStatus, UserProfile } from '../types';
import { loadBusiness, loadLastSync, loadProfile, loadStore, saveBusiness, saveLastSync, saveProfile, saveStore } from './storage';
import { api } from './api';

const emptyStore: StoreData = { products: [], sales: [], expenses: [], debts: [], customers: [], invoices: [] };

function hasLocalData(data: StoreData) {
  return Object.values(data).some(value => Array.isArray(value) && value.length > 0);
}

export function useStore(uid: string) {
  const [data, setData] = useState<StoreData>(() => uid ? loadStore(uid) : emptyStore);
  const [profile, setProfileState] = useState<UserProfile | null>(() => uid ? loadProfile(uid) : null);
  const [business, setBusinessState] = useState<BusinessProfile | null>(() => uid ? loadBusiness(uid) : null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => navigator.onLine ? 'idle' : 'offline');
  const [lastSync, setLastSync] = useState<string | null>(() => uid ? loadLastSync(uid) : null);
  const dataRef = useRef(data);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const loadedRef = useRef(false);
  const syncTimer = useRef<number | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    if (!uid) {
      setData(emptyStore);
      setProfileState(null);
      setBusinessState(null);
      loadedRef.current = false;
      return;
    }
    const local = loadStore(uid);
    setData(local);
    dataRef.current = local;
    setProfileState(loadProfile(uid));
    setBusinessState(loadBusiness(uid));
    setLastSync(loadLastSync(uid));
    dirtyRef.current = false;
    loadedRef.current = false;

    void api.loadStore()
      .then(async remote => {
        versionRef.current = remote.version || 0;
        const remoteData = remote.data || emptyStore;
        if (remote.version > 0 || hasLocalData(remoteData)) {
          setData(remoteData);
          dataRef.current = remoteData;
          saveStore(uid, remoteData);
        } else if (hasLocalData(local)) {
          const saved = await api.saveStore(local, 0);
          versionRef.current = saved.version;
        }
        const now = remote.updatedAt || new Date().toISOString();
        setLastSync(now);
        saveLastSync(uid, now);
        setSyncStatus('synced');
      })
      .catch(() => setSyncStatus(navigator.onLine ? 'error' : 'offline'))
      .finally(() => { loadedRef.current = true; });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    saveStore(uid, data);
    if (!loadedRef.current || !dirtyRef.current || !navigator.onLine) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      setSyncStatus('syncing');
      void api.saveStore(dataRef.current, versionRef.current)
        .then(result => {
          versionRef.current = result.version;
          dirtyRef.current = false;
          const now = result.updatedAt || new Date().toISOString();
          setLastSync(now);
          saveLastSync(uid, now);
          setSyncStatus('synced');
        })
        .catch(() => setSyncStatus(navigator.onLine ? 'error' : 'offline'));
    }, 700);
    return () => { if (syncTimer.current) window.clearTimeout(syncTimer.current); };
  }, [uid, data]);

  useEffect(() => {
    if (!uid) return;
    const interval = window.setInterval(() => {
      if (!navigator.onLine || dirtyRef.current) return;
      void api.loadStore().then(remote => {
        if ((remote.version || 0) > versionRef.current) {
          versionRef.current = remote.version;
          setData(remote.data || emptyStore);
          saveStore(uid, remote.data || emptyStore);
          const now = remote.updatedAt || new Date().toISOString();
          setLastSync(now);
          saveLastSync(uid, now);
          setSyncStatus('synced');
        }
      }).catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [uid]);

  useEffect(() => {
    const online = () => { void syncNow(); };
    const offline = () => setSyncStatus('offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  });

  function mutate(updater: (current: StoreData) => StoreData) {
    dirtyRef.current = true;
    setData(current => updater(current));
  }

  async function syncNow() {
    if (!uid) return;
    if (!navigator.onLine) throw new Error('You are offline. OjaFlow will sync when your connection returns.');
    setSyncStatus('syncing');
    const result = await api.saveStore(dataRef.current, versionRef.current);
    versionRef.current = result.version;
    dirtyRef.current = false;
    const now = result.updatedAt || new Date().toISOString();
    setLastSync(now);
    saveLastSync(uid, now);
    setSyncStatus('synced');
  }

  const actions = useMemo(() => ({
    addProduct: (item: Product) => mutate(current => ({ ...current, products: [item, ...current.products] })),
    addSale: (item: Sale) => mutate(current => ({
      ...current,
      sales: [item, ...current.sales],
      products: current.products.map(product => product.name.toLowerCase() === item.itemName.toLowerCase() ? { ...product, stock: Math.max(0, product.stock - item.quantity) } : product)
    })),
    addExpense: (item: Expense) => mutate(current => ({ ...current, expenses: [item, ...current.expenses] })),
    addDebt: (item: Debt) => mutate(current => ({ ...current, debts: [item, ...current.debts] })),
    addCustomer: (item: Customer) => mutate(current => ({ ...current, customers: [item, ...current.customers] })),
    updateCustomer: (item: Customer) => mutate(current => ({ ...current, customers: current.customers.map(customer => customer.id === item.id ? item : customer) })),
    addInvoice: (item: Invoice) => mutate(current => ({ ...current, invoices: [item, ...current.invoices] })),
    updateInvoice: (item: Invoice) => mutate(current => ({ ...current, invoices: current.invoices.map(invoice => invoice.id === item.id ? item : invoice) })),
    updateDebtPaid: (id: string, paid: number) => mutate(current => ({ ...current, debts: current.debts.map(debt => debt.id === id ? { ...debt, paid: Math.min(debt.amount, Math.max(0, paid)) } : debt) })),
    setProfile: (next: UserProfile) => { setProfileState(next); saveProfile(next); },
    setBusiness: (next: BusinessProfile) => { setBusinessState(next); saveBusiness(uid, next); },
    syncNow
  }), [uid]);

  return { data, profile, business, syncStatus, lastSync, actions };
}
