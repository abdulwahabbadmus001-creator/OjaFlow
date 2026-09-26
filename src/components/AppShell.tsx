import {
  CircleUserRound,
  HandCoins,
  Home,
  MessageCircleMore,
  Package,
  Plus,
  ReceiptText,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react';
import type { AppSection, BusinessProfile, SyncStatus, UserProfile } from '../types';
import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import MaintenanceBanner from './MaintenanceBanner';

const nav: Array<{ id: AppSection; key: 'nav.home' | 'nav.sales' | 'nav.inventory' | 'nav.debts' | 'nav.settings'; icon: typeof Home }> = [
  { id: 'home', key: 'nav.home', icon: Home },
  { id: 'sales', key: 'nav.sales', icon: ReceiptText },
  { id: 'inventory', key: 'nav.inventory', icon: Package },
  { id: 'debts', key: 'nav.debts', icon: HandCoins },
  { id: 'more', key: 'nav.settings', icon: Settings }
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
  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase();
  const online = syncStatus !== 'offline' && syncStatus !== 'error';
  const statusLabel = syncStatus === 'syncing'
    ? tr('Syncing')
    : syncStatus === 'synced'
      ? tr('Synced')
      : syncStatus === 'offline'
        ? tr('Offline')
        : syncStatus === 'error'
          ? tr('Sync issue')
          : tr('Ready');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">O</span>
          <div>
            <strong>OjaFlow</strong>
            <small>{tr('Business command centre')}</small>
          </div>
        </div>

        <div className="workspace-card">
          <span className="workspace-kicker">{tr('CURRENT BUSINESS')}</span>
          <strong>{business.businessName}</strong>
          <small>{tr(business.category)}</small>
        </div>

        <nav className="sidebar-nav" aria-label={tr('Primary navigation')}>
          <span className="nav-caption">{tr('WORKSPACE')}</span>
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={section === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setSection(item.id)}
              >
                <Icon size={19} />
                <span>{tr(item.key)}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className={`sync-mini ${syncStatus}`}>
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}
            <span>{statusLabel}</span>
          </div>
          <div className="sidebar-user">
            <div className="avatar">{initials || <CircleUserRound size={18} />}</div>
            <div>
              <strong>{profile.firstName} {profile.lastName}</strong>
              <small>{tr('Business owner')}</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="mobile-top">
          <div className="brand compact">
            <span className="brand-mark">O</span>
            <div>
              <b>OjaFlow</b>
              <small>{business.businessName}</small>
            </div>
          </div>
          <span className={`sync-dot ${syncStatus}`} title={statusLabel} />
        </header>

        <MaintenanceBanner />
        <div className="content">{children}</div>

        <div className="floating-actions">
          <button className="chat-fab" onClick={onChat} aria-label={tr('Open OjaChat')}>
            <MessageCircleMore size={20} />
            <span>OjaChat</span>
          </button>
          <button className="quick-fab" onClick={onQuick} aria-label={tr('Quick action')}>
            <Plus size={24} />
          </button>
        </div>

        <nav className="bottom-nav" aria-label={tr('Mobile navigation')}>
          {nav.map(item => {
            const Icon = item.icon;
            const label = tr(item.key);
            return (
              <button
                key={item.id}
                className={section === item.id ? 'active' : ''}
                onClick={() => setSection(item.id)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </main>
    </div>
  );
}