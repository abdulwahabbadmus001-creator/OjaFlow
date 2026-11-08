import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
  ProtectedRoute,
  PublicOnlyRoute,
  QuickActionSheet,
  resolveInitialSection,
  syncSectionHash
} from './router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api, type RemoteStoreSnapshot } from './lib/api';
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

function AppContent() {
  const {
    session,
    business: authBusiness,
    isAuthenticated,
    authenticateUser,
    updateSessionProfile,
    updateSessionBusiness,
    logout: performLogout,
    clearDeletedAccount
  } = useAuth();

  const [section, setSectionState] = useState<AppSection>(() =>
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

  const setSection = useCallback((nextSection: AppSection) => {
    setSectionState(nextSection);
    syncSectionHash(nextSection);
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      const isAdmin = isSecretAdminRoute();
      setAdminView(isAdmin);
      if (!isAdmin && isAuthenticated) {
        const nextSection = resolveInitialSection();
        setSectionState(prev => (window.location.hash ? nextSection : prev));
      }
    };
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, [isAuthenticated]);

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

  function handleAuthenticated(
    profile: UserProfile,
    business?: BusinessProfile | null,
    remoteStore?: RemoteStoreSnapshot,
    tokens?: { accessToken?: string; csrfToken?: string }
  ) {
    authenticateUser(profile, business, remoteStore, tokens);
    store.actions.setProfile(profile);
    if (business) {
      store.actions.setBusiness(business);
    }
    setSection('home');
  }

  async function handleLogout() {
    await performLogout(() => store.actions.syncNow());
    setSectionState('home');
    setChat(false);
    setQuick(false);
  }

  function handleDeleted() {
    clearDeletedAccount();
    setSectionState('home');
    setChat(false);
    setQuick(false);
  }

  const currentBusiness = store.business || authBusiness;
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

  const loginView = (
    <PublicOnlyRoute fallback={<AppShellFallback />}>
      <Suspense fallback={<AppShellFallback />}>
        <AuthRoute
          onAuthenticated={handleAuthenticated}
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
    </PublicOnlyRoute>
  );

  return (
    <ProtectedRoute fallback={loginView}>
      {!session ? (
        loginView
      ) : !currentBusiness || !session.businessProfileCompleted ? (
        <LanguageProvider language={session.preferredLanguage}>
          <Suspense fallback={<AppShellFallback subtitle="Business Setup" />}>
            <BusinessSetupRoute
              phone={session.phoneNumber}
              onComplete={business => {
                void (async () => {
                  const profile: UserProfile = {
                    ...session,
                    businessProfileCompleted: true,
                    onboardingCompleted: true
                  };
                  try {
                    const remote = await api.saveProfile(profile, business);
                    const nextBusiness = remote.business || business;
                    store.actions.setBusiness(nextBusiness);
                    store.actions.setProfile(remote.profile);
                    handleAuthenticated(remote.profile, nextBusiness);
                  } catch {
                    store.actions.setBusiness(business);
                    store.actions.setProfile(profile);
                    handleAuthenticated(profile, business);
                  }
                })();
              }}
            />
          </Suspense>
        </LanguageProvider>
      ) : !shell ? (
        <AppShellFallback />
      ) : (
        <LanguageProvider language={shell.profile.preferredLanguage}>
          <AppShell
            section={section}
            setSection={setSection}
            profile={shell.profile}
            business={shell.business}
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
              profile={shell.profile}
              business={shell.business}
              data={store.data}
              actions={{
                ...store.actions,
                setBusiness: nextBusiness => {
                  store.actions.setBusiness(nextBusiness);
                  updateSessionBusiness(nextBusiness);
                }
              }}
              theme={theme}
              setTheme={setTheme}
              syncStatus={store.syncStatus}
              lastSync={store.lastSync}
              onProfileChange={next => {
                store.actions.setProfile(next);
                updateSessionProfile(next);
              }}
              onLogout={handleLogout}
              onDelete={handleDeleted}
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
                  business={shell.business}
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
      )}
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
