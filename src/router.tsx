import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import type {
  AppSection,
  BusinessProfile,
  Customer,
  Debt,
  Expense,
  Invoice,
  Product,
  Sale,
  StoreData,
  SyncStatus,
  ThemePreference,
  UserProfile
} from './types';
import RouteFallback, { AppShellFallback } from './components/RouteFallback';
import {
  navigateToDashboardHash,
  navigateToLoginHash,
  useAuth
} from './context/AuthContext';

// Lazy-loaded route views (Route-Based Code Splitting)
export const DashboardRoute = lazy(() => import('./pages/Dashboard'));
export const SalesRoute = lazy(() => import('./pages/SalesPage'));
export const StockRoute = lazy(() => import('./pages/InventoryPage'));
export const ExpensesRoute = lazy(() => import('./pages/ExpensesPage'));
export const CustomersRoute = lazy(() => import('./pages/CustomersPage'));
export const InvoicesRoute = lazy(() => import('./pages/InvoicesPage'));
export const DebtsRoute = lazy(() => import('./pages/DebtsPage'));
export const SettingsRoute = lazy(() => import('./pages/SettingsPage'));

// Lazy-loaded onboarding, auth, admin & modal views
export const AuthRoute = lazy(() => import('./pages/AuthPage'));
export const BusinessSetupRoute = lazy(() => import('./pages/BusinessSetup'));
export const AdminRoute = lazy(() => import('./pages/AdminPage'));
export const OjaChatDrawer = lazy(() => import('./components/OjaChat'));
export const QuickActionSheet = lazy(() => import('./components/QuickAction'));
export const LegalPagesModal = lazy(() => import('./components/LegalPages'));

export type RoutePreloadTarget =
  | AppSection
  | 'expenses'
  | 'customers'
  | 'invoices'
  | 'chat'
  | 'quick';

const routePreloaders: Record<RoutePreloadTarget, () => Promise<unknown>> = {
  home: () => import('./pages/Dashboard'),
  sales: () => import('./pages/SalesPage'),
  inventory: () => import('./pages/InventoryPage'),
  expenses: () => import('./pages/ExpensesPage'),
  customers: () => import('./pages/CustomersPage'),
  invoices: () => import('./pages/InvoicesPage'),
  debts: () => import('./pages/DebtsPage'),
  more: () => import('./pages/SettingsPage'),
  chat: () => import('./components/OjaChat'),
  quick: () => import('./components/QuickAction')
};

export function preloadRoute(target: RoutePreloadTarget): void {
  const loader = routePreloaders[target];
  if (loader) {
    void loader().catch(() => undefined);
  }
}

export function sectionToHash(section: AppSection): string {
  switch (section) {
    case 'home':
      return '#/dashboard';
    case 'sales':
      return '#/sales';
    case 'inventory':
      return '#/stock';
    case 'debts':
      return '#/debts';
    case 'more':
      return '#/settings';
    default:
      return '#/dashboard';
  }
}

export function syncSectionHash(section: AppSection): void {
  if (typeof window === 'undefined') return;
  const targetHash = sectionToHash(section);
  if (window.location.hash !== targetHash) {
    window.history.replaceState(null, '', targetHash);
  }
}

export function resolveInitialSection(): AppSection {
  if (typeof window === 'undefined') return 'home';
  const slug = window.location.hash
    .replace(/^#\/?/, '')
    .trim()
    .toLowerCase();

  switch (slug) {
    case 'dashboard':
    case 'home':
      return 'home';
    case 'sales':
      sessionStorage.setItem('ojaflow:sales-tab', 'sales');
      return 'sales';
    case 'expenses':
      sessionStorage.setItem('ojaflow:sales-tab', 'expenses');
      return 'sales';
    case 'customers':
      sessionStorage.setItem('ojaflow:sales-tab', 'customers');
      return 'sales';
    case 'invoices':
      sessionStorage.setItem('ojaflow:sales-tab', 'invoices');
      return 'sales';
    case 'stock':
    case 'inventory':
      return 'inventory';
    case 'debts':
      return 'debts';
    case 'settings':
    case 'more':
      return 'more';
    default:
      return 'home';
  }
}

/**
 * Router Guard: Ensures only authenticated users can access protected dashboard routes.
 * Unauthenticated visitors are automatically redirected back to `#/login`.
 */
export function ProtectedRoute({
  children,
  fallback
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const { isAuthenticated, isInitializing } = useAuth();

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigateToLoginHash();
    }
  }, [isAuthenticated, isInitializing]);

  if (isInitializing) {
    return <AppShellFallback />;
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Router Guard: Ensures authenticated users visiting `#/login` are automatically
 * routed straight to `#/dashboard`, bypassing the login screen entirely.
 */
export function PublicOnlyRoute({
  children,
  fallback = null
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAuthenticated, isInitializing } = useAuth();

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigateToDashboardHash();
    }
  }, [isAuthenticated, isInitializing]);

  if (isInitializing) {
    return <AppShellFallback />;
  }

  if (isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export interface AppRouterProps {
  section: AppSection;
  setSection: (section: AppSection) => void;
  profile: UserProfile;
  business: BusinessProfile;
  data: StoreData;
  actions: {
    addProduct: (item: Product) => void;
    addSale: (item: Sale) => void;
    addExpense: (item: Expense) => void;
    addDebt: (item: Debt) => void;
    addCustomer: (item: Customer) => void;
    updateCustomer: (item: Customer) => void;
    addInvoice: (item: Invoice) => void;
    updateInvoice: (item: Invoice) => void;
    updateDebtPaid: (id: string, paid: number) => void;
    setProfile: (next: UserProfile) => void;
    setBusiness: (next: BusinessProfile) => void;
    syncNow: () => Promise<void>;
  };
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  syncStatus: SyncStatus;
  lastSync: string | null;
  onProfileChange: (next: UserProfile) => void;
  onLogout: () => void;
  onDelete: () => void;
  setLegalPage: (page: 'terms' | 'privacy' | 'faq') => void;
}

export function AppRouter({
  section,
  setSection,
  profile,
  business,
  data,
  actions,
  theme,
  setTheme,
  syncStatus,
  lastSync,
  onProfileChange,
  onLogout,
  onDelete,
  setLegalPage
}: AppRouterProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      {section === 'home' && (
        <DashboardRoute
          profile={profile}
          business={business}
          data={data}
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

      {section === 'sales' && (
        <SalesRoute
          data={data}
          business={business}
          preferredLanguage={profile.preferredLanguage}
          addSale={actions.addSale}
          addExpense={actions.addExpense}
          addCustomer={actions.addCustomer}
          updateCustomer={actions.updateCustomer}
          addInvoice={actions.addInvoice}
          updateInvoice={actions.updateInvoice}
        />
      )}

      {section === 'inventory' && (
        <StockRoute data={data} addProduct={actions.addProduct} />
      )}

      {section === 'debts' && (
        <DebtsRoute
          data={data}
          business={business}
          addDebt={actions.addDebt}
          updateDebtPaid={actions.updateDebtPaid}
        />
      )}

      {section === 'more' && (
        <SettingsRoute
          uid={profile.uid}
          profile={profile}
          business={business}
          data={data}
          onProfile={onProfileChange}
          onBusiness={actions.setBusiness}
          onLogout={onLogout}
          onDelete={onDelete}
          theme={theme}
          setTheme={setTheme}
          syncStatus={syncStatus}
          lastSync={lastSync}
          onSyncNow={actions.syncNow}
          setLegalPage={setLegalPage}
        />
      )}
    </Suspense>
  );
}
