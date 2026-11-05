import { useEffect, useState } from 'react';
import {
  Bell,
  Check,
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
  UserNotificationItem,
  UserProfile
} from '../types';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import MaintenanceBanner from './MaintenanceBanner';
import PwaInstallBanner from './PwaInstallBanner';
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
  syncStatus,
  pendingOfflineCount = 0,
  syncToast = null,
  onDismissSyncToast
}: {
  section: AppSection;
  setSection: (section: AppSection) => void;
  profile: UserProfile;
  business: BusinessProfile;
  children: ReactNode;
  onQuick: () => void;
  onChat: () => void;
  syncStatus: SyncStatus;
  pendingOfflineCount?: number;
  syncToast?: string | null;
  onDismissSyncToast?: () => void;
}) {
  const { tr } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotificationItem[]>(
    []
  );

  useEffect(() => {
    let active = true;

    async function fetchNotifications() {
      if (!navigator.onLine) return;
      try {
        const res = await api.myNotifications();
        if (active) {
          setNotifications(
            (res.notifications || []).filter(item => !item.isRead)
          );
        }
      } catch {
        /* ignore background polling errors */
      }
    }

    void fetchNotifications();
    const timer = window.setInterval(() => {
      void fetchNotifications();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [profile.uid]);

  async function dismissNotification(id: string) {
    setNotifications(current => current.filter(item => item.id !== id));
    try {
      await api.markNotificationRead(id);
    } catch {
      /* ignore */
    }
  }

  async function dismissAllNotifications() {
    setNotifications([]);
    try {
      await api.markAllNotificationsRead();
    } catch {
      /* ignore */
    }
  }

  const initials = `${profile.firstName?.[0] || ''}${
    profile.lastName?.[0] || ''
  }`.toUpperCase();

  const online = syncStatus !== 'offline' && syncStatus !== 'error';

  const statusLabel =
    syncStatus === 'syncing'
      ? pendingOfflineCount > 0
        ? `${tr('Syncing')} (${pendingOfflineCount})`
        : tr('Syncing')
      : syncStatus === 'synced'
        ? tr('Synced')
        : syncStatus === 'offline'
          ? pendingOfflineCount > 0
            ? `${tr('Offline')} • ${pendingOfflineCount} ${tr('queued')}`
            : tr('Offline')
          : syncStatus === 'error'
            ? pendingOfflineCount > 0
              ? `${tr('Offline queue')} (${pendingOfflineCount})`
              : tr('Sync issue')
            : tr('Ready');

  function navigate(target: AppSection) {
    setSection(target);
    setMenuOpen(false);
  }

  return (
    <div className="premium-shell">
      <header className="premium-topbar">
        <div className="topbar-inner">
          <BrandLogo compact subtitle={business.businessName} />

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
                    section === item.id ? 'top-nav-item active' : 'top-nav-item'
                  }
                  onClick={() => navigate(item.id)}
                >
                  <Icon size={17} />
                  <span>{tr(item.key)}</span>
                </button>
              );
            })}
          </nav>

          <div className="topbar-actions">
            <div className={`topbar-sync ${syncStatus}`} title={statusLabel}>
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{statusLabel}</span>
            </div>

            <div
              className="topbar-user"
              title={`OjaTag: ${profile.ojaTag}`}
            >
              <div className="avatar">
                {initials || <CircleUserRound size={18} />}
              </div>

              <div>
                <strong>
                  {profile.firstName} {profile.lastName}
                </strong>
                <small>{profile.ojaTag || tr('Business owner')}</small>
              </div>
            </div>

            <button
              type="button"
              className="mobile-menu-trigger"
              onClick={() => setMenuOpen(value => !value)}
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-nav-panel">
          <div className="mobile-nav-business">
            <span>{tr('CURRENT BUSINESS')}</span>
            <strong>{business.businessName}</strong>
            <small>{tr(business.category)}</small>
            {profile.ojaTag && (
              <small className="mobile-ojatag">
                OjaTag: {profile.ojaTag}
              </small>
            )}
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
                  onClick={() => navigate(item.id)}
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
        {syncToast && (
          <div
            className="offline-sync-toast"
            role="status"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #065f46, #047857)',
              color: '#ffffff',
              boxShadow: '0 10px 25px rgba(4, 120, 87, 0.24)',
              fontWeight: 600,
              fontSize: '0.92rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Check size={18} />
              <span>{syncToast}</span>
            </div>
            {onDismissSyncToast && (
              <button
                type="button"
                onClick={onDismissSyncToast}
                aria-label={tr('Dismiss')}
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  border: 0,
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.25rem 0.45rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
        <PwaInstallBanner />
        <MaintenanceBanner />

        {notifications.length > 0 && (
          <section
            className="user-support-banner-stack"
            aria-live="polite"
          >
            {notifications.map(item => (
              <div
                key={item.id}
                className="user-support-notification-banner"
              >
                <div className="user-support-banner-icon">
                  <Bell size={19} />
                </div>

                <div className="user-support-banner-body">
                  <div className="user-support-banner-head">
                    <span className="user-support-badge">
                      {item.kind === 'support_reply'
                        ? tr('SUPPORT REPLY')
                        : tr('ACCOUNT NOTICE')}
                    </span>
                    {item.createdAt && (
                      <small>
                        {new Date(item.createdAt).toLocaleString()}
                      </small>
                    )}
                  </div>

                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                </div>

                <button
                  type="button"
                  className="user-support-dismiss-btn"
                  onClick={() => void dismissNotification(item.id)}
                >
                  <Check size={16} />
                  <span>{tr('Got it')}</span>
                </button>
              </div>
            ))}

            {notifications.length > 1 && (
              <div className="user-support-dismiss-all">
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => void dismissAllNotifications()}
                >
                  {tr('Mark all notifications as read')}
                </button>
              </div>
            )}
          </section>
        )}

        <div className="content">{children}</div>

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
