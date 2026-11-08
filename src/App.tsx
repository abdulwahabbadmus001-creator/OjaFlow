import { Suspense, useEffect, useMemo, useState } from 'react';
import type {
  AppSection,
  BusinessProfile,
  ThemePreference,
  UserProfile
} from './types';
import AppShell from './components/AppShell';
import CookieBanner, { COOKIE_CONSENT_KEY } from './components/CookieBanner';
import RouteFallback, { AppShellFallback } from './components/RouteFallback';
import {
  AdminRoute,
  AppRouter,
  AuthRoute,
  BusinessSetupRoute,
  LegalPagesModal,
  OjaChatDrawer,
  QuickActionSheet,
  resolveInitialSection
} from './router';
import {
  clearAllUserCaches,
  clearUserCache,
  loadCachedSession,
  saveBusiness,
  saveLastSync,
  saveProfile,
  saveStore,
  scheduleDeferredTask
} from './lib/storage';
import { api, clearCsrf, type RemoteStoreSnapshot } from './lib/api';
import { useStore } from './lib/useStore';
import { LanguageProvider } from './lib/i18n';

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
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export default function App() {
  // Synchronously hydrate cached session so returning users render the UI shell in 0ms
  const [session, setSession] = useState<UserProfile | null>(() =>
    loadCachedSession()
  );
  const [section, setSection] = useState<AppSection>(() =>
    resolveInitialSection()
  );
  const [quick, setQuick] = useState(false);
  const [chat, setChat] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(
    () => (localStorage.getItem(THEME_KEY) as ThemePreference) || 'system'
  );
  const [cookieConsentAccepted, setCookieConsentAccepted] = useState(
    () => localStorage.getItem(COOKIE_CONSENT_KEY) === 'true'
  );
  const [adminView, setAdminView] = useState(() => isSecretAdminRoute());

  useEffect(() => {
    const syncRoute = () => {
      const isAdmin = isSecretAdminRoute();
      setAdminView(isAdmin);
      if (!isAdmin) {
        const nextSection = resolveInitialSection();
        setSection(prev => (window.location.hash ? nextSection : prev));
      }
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
  const [legalPage, setLegalPage] = useState<
    'terms' | 'privacy' | 'faq' | null
  >(null);

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

  // Defer session verification to the background so it never blocks first paint
  useEffect(() => {
    let active = true;
    const cancelDeferred = scheduleDeferredTask(() => {
      if (!navigator.onLine) return;
      void api
        .session()
        .then(result => {
          if (!active) return;
          activate(result.profile, result.business, result.store, false);
        })
        .catch(() => {
          if (!active || !navigator.onLine) return;
          clearAllUserCaches();
          clearCsrf();
          setSession(null);
        });
    }, 80);

    return () => {
      active = false;
      cancelDeferred();
    };
  }, []);

  function activate(
    profile: UserProfile,
    business?: BusinessProfile | null,
    remoteStore?: RemoteStoreSnapshot,
    resetSection = true
  ) {
    if (session && session.uid !== profile.uid) {
      clearUserCache(session.uid);
    }
    saveProfile(profile);
    store.actions.setProfile(profile);
    if (business) {
      saveBusiness(profile.uid, business);
      store.actions.setBusiness(business);
    }
    if (remoteStore?.data) {
      saveStore(profile.uid, remoteStore.data);
      if (remoteStore.updatedAt) {
        saveLastSync(profile.uid, remoteStore.updatedAt);
      }
    }
    setSession(profile);
    if (resetSection) {
      setSection('home');
    }
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
  const currentProfile = store.profile || session;
  const shell = useMemo(() => {
    if (!session || !currentProfile || !currentBusiness) return null;
    return { profile: currentProfile, business: currentBusiness };
  }, [session, currentProfile, currentBusiness]);

  if (adminView) {
    return (
      <Suspense fallback={<AppShellFallback subtitle="Admin Console" />}>
        <AdminRoute
          onExitAdmin={() => {
            window.history.replaceState(null, '', '/');
            setAdminView(false);
          }}
        />
      </Suspense>
    );
  }

  if (!session) {
    return (
      <>
        <Suspense fallback={<AppShellFallback />}>
          <AuthRoute
            onAuthenticated={(profile, business, remoteStore) =>
              activate(profile, business, remoteStore, true)
            }
            cookieConsentAccepted={cookieConsentAccepted}
          />
        </Suspense>
        {!cookieConsentAccepted && (
          <CookieBanner
            onAccept={() => {
              localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
              setCookieConsentAccepted(true);
            }}
            onOpenPrivacy={() => setLegalPage('privacy')}
          />
        )}
        {legalPage && (
          <Suspense fallback={null}>
            <LegalPagesModal
              type={legalPage}
              onClose={() => setLegalPage(null)}
            />
          </Suspense>
        )}
      </>
    );
  }

  if (!store.business || !session.businessProfileCompleted) {
    return (
      <LanguageProvider language={session.preferredLanguage}>
        <Suspense fallback={<AppShellFallback subtitle="Business Setup" />}>
          <BusinessSetupRoute
            phone={session.phoneNumber}
            onComplete={business => {
              void (async () => {
                const profile = {
                  ...session,
                  businessProfileCompleted: true,
                  onboardingCompleted: true
                };
                try {
                  const remote = await api.saveProfile(profile, business);
                  store.actions.setBusiness(remote.business || business);
                  store.actions.setProfile(remote.profile);
                  activate(remote.profile, remote.business || business, undefined, true);
                } catch {
                  store.actions.setBusiness(business);
                  store.actions.setProfile(profile);
                  activate(profile, business, undefined, true);
                }
              })();
            }}
          />
        </Suspense>
      </LanguageProvider>
    );
  }

  if (!shell) {
    return <AppShellFallback />;
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
        <AppRouter
          section={section}
          setSection={setSection}
          profile={profile}
          business={business}
          data={store.data}
          actions={store.actions}
          theme={theme}
          setTheme={setTheme}
          syncStatus={store.syncStatus}
          lastSync={store.lastSync}
          onProfileChange={next => {
            store.actions.setProfile(next);
            setSession(next);
          }}
          onLogout={logout}
          onDelete={deleted}
          setLegalPage={setLegalPage}
        />

        {quick && (
          <Suspense fallback={null}>
            <QuickActionSheet
              onClose={() => setQuick(false)}
              onNavigate={setSection}
            />
          </Suspense>
        )}

        {chat && (
          <Suspense fallback={<RouteFallback label="Opening OjaChat…" />}>
            <OjaChatDrawer
              data={store.data}
              business={business}
              onClose={() => setChat(false)}
              onAddSale={store.actions.addSale}
              onAddExpense={store.actions.addExpense}
              onAddDebt={store.actions.addDebt}
            />
          </Suspense>
        )}
      </AppShell>

      {legalPage && (
        <Suspense fallback={null}>
          <LegalPagesModal
            type={legalPage}
            onClose={() => setLegalPage(null)}
          />
        </Suspense>
      )}
    </LanguageProvider>
  );
}
