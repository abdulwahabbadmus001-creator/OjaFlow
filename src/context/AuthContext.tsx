import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { BusinessProfile, UserProfile } from '../types';
import {
  api,
  ApiError,
  clearCsrf,
  CSRF_KEY,
  getCsrfToken,
  getSessionToken,
  rememberCsrf,
  rememberSessionToken,
  SESSION_TOKEN_KEY,
  type RemoteStoreSnapshot
} from '../lib/api';
import {
  AUTH_SESSION_KEY,
  clearAllUserCaches,
  clearAuthSession,
  clearUserCache,
  loadAuthSession,
  saveAuthSession,
  saveBusiness,
  saveLastSync,
  saveProfile,
  saveStore,
  scheduleDeferredTask
} from '../lib/storage';

export interface AuthContextValue {
  session: UserProfile | null;
  business: BusinessProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  authenticateUser: (
    profile: UserProfile,
    business?: BusinessProfile | null,
    remoteStore?: RemoteStoreSnapshot,
    tokens?: { accessToken?: string; csrfToken?: string }
  ) => void;
  updateSessionProfile: (profile: UserProfile) => void;
  updateSessionBusiness: (business: BusinessProfile) => void;
  logout: (beforeClear?: () => Promise<void>) => Promise<void>;
  clearDeletedAccount: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function navigateToLoginHash(): void {
  if (typeof window === 'undefined') return;
  if (window.location.hash !== '#/login') {
    window.history.replaceState(null, '', '#/login');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

export function navigateToDashboardHash(): void {
  if (typeof window === 'undefined') return;
  const slug = window.location.hash
    .replace(/^#\/?/, '')
    .trim()
    .toLowerCase();

  // If the user is on a public/login hash or empty hash, route straight to #/dashboard
  if (
    !slug ||
    slug === 'login' ||
    slug === 'register' ||
    slug === 'forgot' ||
    slug === 'auth'
  ) {
    window.history.replaceState(null, '', '#/dashboard');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // 1. Initial App Mount Check: synchronously read persisted session & token from localStorage
  const initialSnapshot = useMemo(() => loadAuthSession(), []);

  const [session, setSession] = useState<UserProfile | null>(
    () => initialSnapshot?.profile ?? null
  );
  const [business, setBusiness] = useState<BusinessProfile | null>(
    () => initialSnapshot?.business ?? null
  );
  const [token, setToken] = useState<string | null>(
    () =>
      initialSnapshot?.accessToken ||
      getSessionToken() ||
      (initialSnapshot?.profile?.uid ? `local:${initialSnapshot.profile.uid}` : null)
  );
  const [isInitializing, setIsInitializing] = useState(false);

  const isAuthenticated = Boolean(session?.uid && token);

  // Immediately route authenticated users on startup straight to the dashboard, bypassing login
  useEffect(() => {
    if (isAuthenticated) {
      navigateToDashboardHash();
    }
  }, [isAuthenticated]);

  // 2. Token & Session Persistence upon login / registration / PIN recovery
  const authenticateUser = useCallback(
    (
      nextProfile: UserProfile,
      nextBusiness?: BusinessProfile | null,
      remoteStore?: RemoteStoreSnapshot,
      tokens?: { accessToken?: string; csrfToken?: string }
    ) => {
      if (session && session.uid !== nextProfile.uid) {
        clearUserCache(session.uid);
      }

      if (tokens?.accessToken) {
        rememberSessionToken(tokens.accessToken);
      }
      if (tokens?.csrfToken) {
        rememberCsrf(tokens.csrfToken);
      }

      if (remoteStore?.data) {
        saveStore(nextProfile.uid, remoteStore.data);
        if (remoteStore.updatedAt) {
          saveLastSync(nextProfile.uid, remoteStore.updatedAt);
        }
      }

      const persisted = saveAuthSession({
        profile: nextProfile,
        business: nextBusiness !== undefined ? nextBusiness : business,
        accessToken: tokens?.accessToken || getSessionToken() || undefined,
        csrfToken: tokens?.csrfToken || getCsrfToken() || undefined
      });

      setSession(persisted.profile);
      setBusiness(persisted.business);
      setToken(
        persisted.accessToken ||
          getSessionToken() ||
          `local:${persisted.profile.uid}`
      );

      navigateToDashboardHash();
    },
    [business, session]
  );

  const updateSessionProfile = useCallback(
    (nextProfile: UserProfile) => {
      saveProfile(nextProfile);
      saveAuthSession({
        profile: nextProfile,
        business
      });
      setSession(nextProfile);
    },
    [business]
  );

  const updateSessionBusiness = useCallback(
    (nextBusiness: BusinessProfile) => {
      if (session?.uid) {
        saveBusiness(session.uid, nextBusiness);
        saveAuthSession({
          profile: session,
          business: nextBusiness
        });
      }
      setBusiness(nextBusiness);
    },
    [session]
  );

  // 3. Background session refresh on startup (never blocks first paint or wipes valid local session on network hiccups)
  useEffect(() => {
    let active = true;

    const cancelDeferred = scheduleDeferredTask(() => {
      if (!navigator.onLine) return;

      const hasPersistedLocalSession = Boolean(loadAuthSession()?.profile?.uid);
      const hasToken = Boolean(getSessionToken());
      if (!hasPersistedLocalSession && !hasToken) {
        return;
      }

      void api
        .session()
        .then(result => {
          if (!active) return;
          const persisted = saveAuthSession({
            profile: result.profile,
            business: result.business,
            accessToken: result.accessToken || getSessionToken() || undefined,
            csrfToken: result.csrfToken || getCsrfToken() || undefined
          });
          if (result.store?.data) {
            saveStore(result.profile.uid, result.store.data);
            if (result.store.updatedAt) {
              saveLastSync(result.profile.uid, result.store.updatedAt);
            }
          }
          setSession(persisted.profile);
          setBusiness(persisted.business);
          setToken(
            persisted.accessToken ||
              getSessionToken() ||
              `local:${persisted.profile.uid}`
          );
        })
        .catch((err: unknown) => {
          if (!active || !navigator.onLine) return;
          // Only force logout if the server explicitly reports a deactivated/suspended account (403)
          if (err instanceof ApiError && err.status === 403) {
            clearAllUserCaches();
            clearCsrf();
            setSession(null);
            setBusiness(null);
            setToken(null);
            navigateToLoginHash();
          }
        })
        .finally(() => {
          if (active) {
            setIsInitializing(false);
          }
        });
    }, 80);

    return () => {
      active = false;
      cancelDeferred();
    };
  }, []);

  // Cross-tab auth synchronization via localStorage events
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === AUTH_SESSION_KEY ||
        event.key === SESSION_TOKEN_KEY ||
        event.key === CSRF_KEY ||
        event.key === null
      ) {
        const snapshot = loadAuthSession();
        if (snapshot?.profile?.uid) {
          setSession(snapshot.profile);
          setBusiness(snapshot.business);
          setToken(
            snapshot.accessToken ||
              getSessionToken() ||
              `local:${snapshot.profile.uid}`
          );
        } else {
          setSession(null);
          setBusiness(null);
          setToken(null);
          navigateToLoginHash();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 4. Secure Logout: flush sync, call API logout, clear token & session from localStorage, and redirect to #/login
  const logout = useCallback(
    async (beforeClear?: () => Promise<void>) => {
      const currentUid = session?.uid;
      if (beforeClear) {
        try {
          await beforeClear();
        } catch {
          // Proceed with local logout even if offline sync fails
        }
      }

      try {
        await api.logout();
      } catch {
        // Proceed with local cleanup even if offline
      }

      clearAuthSession(currentUid);
      clearAllUserCaches();
      clearCsrf();
      setSession(null);
      setBusiness(null);
      setToken(null);
      navigateToLoginHash();
    },
    [session?.uid]
  );

  const clearDeletedAccount = useCallback(() => {
    const currentUid = session?.uid;
    clearAuthSession(currentUid);
    clearAllUserCaches();
    clearCsrf();
    setSession(null);
    setBusiness(null);
    setToken(null);
    navigateToLoginHash();
  }, [session?.uid]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      business,
      token,
      isAuthenticated,
      isInitializing,
      authenticateUser,
      updateSessionProfile,
      updateSessionBusiness,
      logout,
      clearDeletedAccount
    }),
    [
      session,
      business,
      token,
      isAuthenticated,
      isInitializing,
      authenticateUser,
      updateSessionProfile,
      updateSessionBusiness,
      logout,
      clearDeletedAccount
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
