import { useState } from 'react';

import {
  CircleUserRound,
  HandCoins,
  Home,
  Menu,
  MessageCircleMore,
  Package,
  Plus,
  ReceiptText,
  Settings,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';

import type {
  AppSection,
  BusinessProfile,
  SyncStatus,
  UserProfile
} from '../types';

import type { ReactNode } from 'react';

import { useI18n } from '../lib/i18n';

import MaintenanceBanner from './MaintenanceBanner';
import BrandLogo from './BrandLogo';

const nav: Array<{
  id: AppSection;
  key:
    | 'nav.home'
    | 'nav.sales'
    | 'nav.inventory'
    | 'nav.debts'
    | 'nav.settings';
  icon: typeof Home;
}> = [
  {
    id: 'home',
    key: 'nav.home',
    icon: Home
  },
  {
    id: 'sales',
    key: 'nav.sales',
    icon: ReceiptText
  },
  {
    id: 'inventory',
    key: 'nav.inventory',
    icon: Package
  },
  {
    id: 'debts',
    key: 'nav.debts',
    icon: HandCoins
  },
  {
    id: 'more',
    key: 'nav.settings',
    icon: Settings
  }
];

export default function AppShell({
  section,
  setSection,
  profile,
  business,
  children,
  onQuick,
  onChat,
  syncStatus
}: {
  section: AppSection;
  setSection: (section: AppSection) => void;
  profile: UserProfile;
  business: BusinessProfile;
  children: ReactNode;
  onQuick: () => void;
  onChat: () => void;
  syncStatus: SyncStatus;
}) {
  const { tr } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials =
    `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();

  const online =
    syncStatus !== 'offline' &&
    syncStatus !== 'error';

  const statusLabel =
    syncStatus === 'syncing'
      ? tr('Syncing')
      : syncStatus === 'synced'
        ? tr('Synced')
        : syncStatus === 'offline'
          ? tr('Offline')
          : syncStatus === 'error'
            ? tr('Sync issue')
            : tr('Ready');

  function navigate(target: AppSection) {
    setSection(target);
    setMenuOpen(false);
  }

  return (
    <div className="premium-shell">
      <header className="premium-topbar">
        <div className="topbar-inner">
          <BrandLogo
            compact
            subtitle={business.businessName}
          />

          <nav
            className="desktop-top-nav"
            aria-label={tr('Primary navigation')}
          >
            {nav.map(item => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  className={
                    section === item.id
                      ? 'top-nav-item active'
                      : 'top-nav-item'
                  }
                  onClick={() =>
                    navigate(item.id)
                  }
                >
                  <Icon size={17} />
                  <span>{tr(item.key)}</span>
                </button>
              );
            })}
          </nav>

          <div className="topbar-actions">
            <div
              className={`topbar-sync ${syncStatus}`}
              title={statusLabel}
            >
              {online ? (
                <Wifi size={15} />
              ) : (
                <WifiOff size={15} />
              )}

              <span>{statusLabel}</span>
            </div>

            <div className="topbar-user">
              <div className="avatar">
                {initials || (
                  <CircleUserRound size={18} />
                )}
              </div>

              <div>
                <strong>
                  {profile.firstName}{' '}
                  {profile.lastName}
                </strong>

                <small>
                  {tr('Business owner')}
                </small>
              </div>
            </div>

            <button
              type="button"
              className="mobile-menu-trigger"
              onClick={() =>
                setMenuOpen(value => !value)
              }
              aria-label={
                menuOpen
                  ? 'Close navigation'
                  : 'Open navigation'
              }
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <X size={22} />
              ) : (
                <Menu size={22} />
              )}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-nav-panel">
          <div className="mobile-nav-business">
            <span>
              {tr('CURRENT BUSINESS')}
            </span>

            <strong>
              {business.businessName}
            </strong>

            <small>
              {tr(business.category)}
            </small>
          </div>

          <nav aria-label={tr('Primary navigation')}>
            {nav.map(item => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  className={
                    section === item.id
                      ? 'mobile-nav-item active'
                      : 'mobile-nav-item'
                  }
                  onClick={() =>
                    navigate(item.id)
                  }
                >
                  <Icon size={19} />
                  <span>{tr(item.key)}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <main className="premium-main">
        <MaintenanceBanner />

        <div className="content">
          {children}
        </div>

        <div className="floating-actions">
          <button
            className="chat-fab"
            onClick={onChat}
            aria-label={tr('Open OjaChat')}
          >
            <MessageCircleMore size={20} />
            <span>OjaChat</span>
          </button>

          <button
            className="quick-fab"
            onClick={onQuick}
            aria-label={tr('Quick action')}
          >
            <Plus size={24} />
          </button>
        </div>
      </main>
    </div>
  );
}