import BrandLogo from './components/BrandLogo';
import { useEffect, useMemo, useState } from 'react';
import type { AppSection, BusinessProfile, ThemePreference, UserProfile } from './types';
import AuthPage from './pages/AuthPage';
import AdminPage from './pages/AdminPage';
import BusinessSetup from './pages/BusinessSetup';
import Dashboard from './pages/Dashboard';
import SalesPage from './pages/SalesPage';
import InventoryPage from './pages/InventoryPage';
import DebtsPage from './pages/DebtsPage';
import SettingsPage from './pages/SettingsPage';
import AppShell from './components/AppShell';
import QuickAction from './components/QuickAction';
import OjaChat from './components/OjaChat';
import { clearAllUserCaches, clearUserCache, saveBusiness, saveLastSync, saveProfile, saveStore } from './lib/storage';
import { api, clearCsrf, type RemoteStoreSnapshot } from './lib/api';
import { useStore } from './lib/useStore';
import { LanguageProvider } from './lib/i18n';
import { t } from './lib/language';
import CookieBanner, { COOKIE_CONSENT_KEY } from './components/CookieBanner';
import LegalPages from './components/LegalPages';

const THEME_KEY = 'ojaflow:theme';

// Private, unguessable admin route — never linked publicly in the UI.
// Access only by typing /#secret-admin-portal directly in the browser address bar
// (or override via VITE_ADMIN_PORTAL_HASH in .env).
const SECRET_ADMIN_SLUG = (
  (import.meta.env.VITE_ADMIN_PORTAL_HASH as string | undefined) ||
  'secret-admin-portal'
)
  .trim()
  .replace(/^#\/?|^\/+/, '');

function isSecretAdminRoute(): boolean {
  const hashSlug = window.location.hash.replace(/^#\/?/, '').trim();
  const pathSlug = window.location.pathname.replace(/^\/+|\/+$/g, '').trim();
  return (
    Boolean(SECRET_ADMIN_SLUG) &&
    (hashSlug === SECRET_ADMIN_SLUG || pathSlug === SECRET_ADMIN_SLUG)
  );
}

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
  const [cookieConsentAccepted, setCookieConsentAccepted] = useState(
    () => localStorage.getItem(COOKIE_CONSENT_KEY) === 'true'
  );
  const [adminView, setAdminView] = useState(() => isSecretAdminRoute());

  useEffect(() => {
    const syncRoute = () => {
      setAdminView(isSecretAdminRoute());
    };
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  const uid = session?.uid || '';
  const store = useStore(uid);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | 'faq' | null>(null);

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
      .then(result => activate(result.profile, result.business, result.store))
      .catch(() => {
        clearAllUserCaches();
        clearCsrf();
        setSession(null);
      })
      .finally(() => setChecking(false));
  }, []);

  function activate(
    profile: UserProfile,
    business?: BusinessProfile | null,
    remoteStore?: RemoteStoreSnapshot
  ) {
    if (session && session.uid !== profile.uid) {
      clearUserCache(session.uid);
    }
    saveProfile(profile);
    if (business) {
      saveBusiness(profile.uid, business);
    }
    if (remoteStore?.data) {
      saveStore(profile.uid, remoteStore.data);
      if (remoteStore.updatedAt) {
        saveLastSync(profile.uid, remoteStore.updatedAt);
      }
    }
    setSession(profile);
    setSection('home');
  }

  async function logout() {
    try {
      await store.actions.syncNow();
    } catch {
      /* proceed with logout even if offline */
    }
    try {
      await api.logout();
    } catch {
      /* local cleanup still proceeds */
    }
    if (uid) clearUserCache(uid);
    clearCsrf();
    setSession(null);
    setSection('home');
    setChat(false);
  }

  function deleted() {
    if (uid) clearUserCache(uid);
    clearCsrf();
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

  if (adminView) {
    return (
      <AdminPage
        onExitAdmin={() => {
          window.history.replaceState(null, '', '/');
          setAdminView(false);
        }}
      />
    );
  }

  if (checking) {
    return (
      <div className="splash">
        <BrandLogo />
        <small>
          Preparing your business…
        </small>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <AuthPage
          onAuthenticated={activate}
          cookieConsentAccepted={cookieConsentAccepted}
        />
        {!cookieConsentAccepted && (
          <CookieBanner
            onAccept={() => {
              localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
              setCookieConsentAccepted(true);
            }}
            onOpenPrivacy={() => setLegalPage('privacy')}
          />
        )}
        {legalPage && <LegalPages type={legalPage} onClose={() => setLegalPage(null)} />}
      </>
    );
  }

  if (!store.profile) {
    return (
      <div className="splash">
        <strong>{t(session.preferredLanguage, 'Loading your profile…')}</strong>
      </div>
    );
  }

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

  if (!shell) {
    return (
      <div className="splash">
        <strong>{t(session.preferredLanguage, 'Preparing workspace…')}</strong>
      </div>
    );
  }
  const { profile, business } = shell;

  return (
    <LanguageProvider language={profile.preferredLanguage}>
      <AppShell
        section={section}
        setSection={setSection}
        profile={profile}
        business={business}
        syncStatus={store.syncStatus}
        pendingOfflineCount={store.pendingOfflineCount}
        syncToast={store.syncToast}
        onDismissSyncToast={store.dismissSyncToast}
        onQuick={() => setQuick(true)}
        onChat={() => setChat(true)}
      >
        {section === 'home' && (
          <Dashboard
            profile={profile}
            business={business}
            data={store.data}
            onOpenSales={() => {
              sessionStorage.setItem('ojaflow:sales-tab', 'sales');
              setSection('sales');
            }}
            onOpenInventory={() => setSection('inventory')}
            onOpenDebts={() => setSection('debts')}
            onOpenCustomers={() => {
              sessionStorage.setItem('ojaflow:sales-tab', 'customers');
              setSection('sales');
            }}
          />
        )}
        {section === 'sales' && <SalesPage data={store.data} business={business} preferredLanguage={profile.preferredLanguage} addSale={store.actions.addSale} addExpense={store.actions.addExpense} addCustomer={store.actions.addCustomer} updateCustomer={store.actions.updateCustomer} addInvoice={store.actions.addInvoice} updateInvoice={store.actions.updateInvoice} />}
        {section === 'inventory' && <InventoryPage data={store.data} addProduct={store.actions.addProduct} />}
        {section === 'debts' && <DebtsPage data={store.data} business={business} addDebt={store.actions.addDebt} updateDebtPaid={store.actions.updateDebtPaid} />}
        {section === 'more' && <SettingsPage uid={profile.uid} profile={profile} business={business} data={store.data} onProfile={next => { store.actions.setProfile(next); setSession(next); }} onBusiness={store.actions.setBusiness} onLogout={logout} onDelete={deleted} theme={theme} setTheme={setTheme} syncStatus={store.syncStatus} lastSync={store.lastSync} onSyncNow={store.actions.syncNow} setLegalPage={setLegalPage} />}
        {quick && <QuickAction onClose={() => setQuick(false)} onNavigate={setSection} />}
        {chat && (
          <OjaChat
            data={store.data}
            business={business}
            onClose={() => setChat(false)}
            onAddSale={store.actions.addSale}
            onAddExpense={store.actions.addExpense}
            onAddDebt={store.actions.addDebt}
          />
        )}
      </AppShell>
      {legalPage && <LegalPages type={legalPage} onClose={() => setLegalPage(null)} />}
    </LanguageProvider>
  );
}
