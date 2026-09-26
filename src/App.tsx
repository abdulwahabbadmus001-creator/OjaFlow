import { useEffect, useMemo, useState } from 'react';
import type { AppSection, BusinessProfile, ThemePreference, UserProfile } from './types';
import AuthPage from './pages/AuthPage';
import BusinessSetup from './pages/BusinessSetup';
import Dashboard from './pages/Dashboard';
import SalesPage from './pages/SalesPage';
import InventoryPage from './pages/InventoryPage';
import DebtsPage from './pages/DebtsPage';
import SettingsPage from './pages/SettingsPage';
import AppShell from './components/AppShell';
import QuickAction from './components/QuickAction';
import OjaChat from './components/OjaChat';
import { clearUserCache, saveBusiness, saveProfile } from './lib/storage';
import { api } from './lib/api';
import { useStore } from './lib/useStore';
import { LanguageProvider } from './lib/i18n';
import { t } from './lib/language';

const THEME_KEY = 'ojaflow:theme';

function resolveTheme(preference: ThemePreference) {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [session, setSession] = useState<UserProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState<AppSection>('home');
  const [quick, setQuick] = useState(false);
  const [chat, setChat] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => (localStorage.getItem(THEME_KEY) as ThemePreference) || 'system');

  const uid = session?.uid || '';
  const store = useStore(uid);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme);
      localStorage.setItem(THEME_KEY, theme);
    };
    apply();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    void api.session()
      .then(result => activate(result.profile, result.business))
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
  }, []);

  function activate(profile: UserProfile, business?: BusinessProfile | null) {
    saveProfile(profile);
    if (business) saveBusiness(profile.uid, business);
    setSession(profile);
    setSection('home');
  }

  async function logout() {
    try { await api.logout(); } catch { /* local cleanup still proceeds */ }
    if (uid) clearUserCache(uid);
    setSession(null);
    setSection('home');
    setChat(false);
  }

  function deleted() {
    if (uid) clearUserCache(uid);
    setSession(null);
    setSection('home');
    setChat(false);
  }

  const currentBusiness = store.business;
  const currentProfile = store.profile;
  const shell = useMemo(() => {
    if (!session || !currentProfile || !currentBusiness) return null;
    return { profile: currentProfile, business: currentBusiness };
  }, [session, currentProfile, currentBusiness]);

  if (checking) {
    return <div className="splash"><span className="brand-mark giant">O</span><strong>OjaFlow</strong><small>Preparing your business workspace…</small></div>;
  }

  if (!session) return <AuthPage onAuthenticated={activate} />;
  if (!store.profile) return <div className="splash"><strong>{t(session.preferredLanguage, 'Loading your profile…')}</strong></div>;

  if (!store.business || !session.businessProfileCompleted) {
    return (
      <LanguageProvider language={session.preferredLanguage}>
        <BusinessSetup
          phone={session.phoneNumber}
          onComplete={business => {
            void (async () => {
              const profile = { ...session, businessProfileCompleted: true, onboardingCompleted: true };
              try {
                const remote = await api.saveProfile(profile, business);
                store.actions.setBusiness(remote.business || business);
                store.actions.setProfile(remote.profile);
                activate(remote.profile, remote.business || business);
              } catch {
                store.actions.setBusiness(business);
                store.actions.setProfile(profile);
                activate(profile, business);
              }
            })();
          }}
        />
      </LanguageProvider>
    );
  }

  if (!shell) return <div className="splash"><strong>{t(session.preferredLanguage, 'Preparing workspace…')}</strong></div>;
  const { profile, business } = shell;

  return (
    <LanguageProvider language={profile.preferredLanguage}>
      <AppShell section={section} setSection={setSection} profile={profile} business={business} syncStatus={store.syncStatus} onQuick={() => setQuick(true)} onChat={() => setChat(true)}>
        {section === 'home' && <Dashboard profile={profile} business={business} data={store.data} onOpenSales={() => setSection('sales')} onOpenInventory={() => setSection('inventory')} onOpenDebts={() => setSection('debts')} />}
        {section === 'sales' && <SalesPage data={store.data} business={business} preferredLanguage={profile.preferredLanguage} addSale={store.actions.addSale} addExpense={store.actions.addExpense} addCustomer={store.actions.addCustomer} updateCustomer={store.actions.updateCustomer} addInvoice={store.actions.addInvoice} updateInvoice={store.actions.updateInvoice} />}
        {section === 'inventory' && <InventoryPage data={store.data} addProduct={store.actions.addProduct} />}
        {section === 'debts' && <DebtsPage data={store.data} addDebt={store.actions.addDebt} updateDebtPaid={store.actions.updateDebtPaid} />}
        {section === 'more' && <SettingsPage uid={profile.uid} profile={profile} business={business} data={store.data} onProfile={next => { store.actions.setProfile(next); setSession(next); }} onBusiness={store.actions.setBusiness} onLogout={logout} onDelete={deleted} theme={theme} setTheme={setTheme} syncStatus={store.syncStatus} lastSync={store.lastSync} onSyncNow={store.actions.syncNow} />}
        {quick && <QuickAction onClose={() => setQuick(false)} onNavigate={setSection} />}
        {chat && <OjaChat data={store.data} business={business} onClose={() => setChat(false)} />}
      </AppShell>
    </LanguageProvider>
  );
}