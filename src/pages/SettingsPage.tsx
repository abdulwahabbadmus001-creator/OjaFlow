import { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  KeyRound,
  LogOut,
  Languages,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  Store,
  Sun,
  Trash2,
  UserRound
} from 'lucide-react';
import type {
  BusinessProfile,
  NotificationPreferences,
  StoreData,
  SyncStatus,
  ThemePreference,
  UserProfile
} from '../types';
import { maskPhone } from '../lib/phone';
import { api } from '../lib/api';
import { exportAllAsCsv, exportAllAsJson, exportSummary } from '../lib/exportData';
import { loadNotifications, saveNotifications } from '../lib/storage';
import { languageLabel, languageOptions } from '../lib/language';
import { useI18n } from '../lib/i18n';
import type { LanguagePreference } from '../types';

type Screen =
  | 'root'
  | 'profile'
  | 'business'
  | 'security'
  | 'password'
  | 'appearance'
  | 'language'
  | 'notifications'
  | 'sync'
  | 'export'
  | 'help'
  | 'about'
  | 'privacy'
  | 'terms'
  | 'logout'
  | 'delete';

export default function SettingsPage({
  uid,
  profile,
  business,
  data,
  onProfile,
  onBusiness,
  onLogout,
  onDelete,
  theme,
  setTheme,
  syncStatus,
  lastSync,
  onSyncNow
}: {
  uid: string;
  profile: UserProfile;
  business: BusinessProfile;
  data: StoreData;
  onProfile: (profile: UserProfile) => void;
  onBusiness: (business: BusinessProfile) => void;
  onLogout: () => void;
  onDelete: () => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  syncStatus: SyncStatus;
  lastSync: string | null;
  onSyncNow: () => Promise<void>;
}) {
  const [screen, setScreen] = useState<Screen>('root');
  const { tr } = useI18n();
  const back = () => setScreen('root');

  if (screen === 'profile') {
    return <ProfileScreen profile={profile} onSave={onProfile} onBack={back} />;
  }
  if (screen === 'business') {
    return <BusinessScreen profile={profile} business={business} onSave={onBusiness} onBack={back} />;
  }
  if (screen === 'security') {
    return <SecurityScreen profile={profile} onBack={back} onChangePassword={() => setScreen('password')} />;
  }
  if (screen === 'password') {
    return <ChangePasswordScreen onBack={() => setScreen('security')} />;
  }
  if (screen === 'appearance') {
    return <AppearanceScreen theme={theme} setTheme={setTheme} onBack={back} />;
  }
  if (screen === 'language') {
    return <LanguageScreen profile={profile} business={business} onSave={onProfile} onBack={back} />;
  }
  if (screen === 'notifications') {
    return <NotificationsScreen uid={uid} onBack={back} />;
  }
  if (screen === 'sync') {
    return <SyncScreen syncStatus={syncStatus} lastSync={lastSync} onSyncNow={onSyncNow} onBack={back} />;
  }
  if (screen === 'export') {
    return <ExportScreen profile={profile} business={business} data={data} onBack={back} />;
  }
  if (screen === 'help') {
    return <HelpScreen onBack={back} />;
  }
  if (screen === 'about') {
    return <AboutScreen onBack={back} />;
  }
  if (screen === 'privacy') {
    return <PrivacyScreen onBack={back} />;
  }
  if (screen === 'terms') {
    return <TermsScreen onBack={back} />;
  }
  if (screen === 'logout') {
    return <LogoutScreen onBack={back} onLogout={onLogout} />;
  }
  if (screen === 'delete') {
    return <DeleteScreen profile={profile} onBack={back} onDelete={onDelete} />;
  }

  return (
    <>
      <header className="page-head settings-heading">
        <div>
          <span className="eyebrow">{tr('CONTROL CENTRE')}</span>
          <h1>{tr('Settings')}</h1>
          <p>{tr('Account, security, data and preferences — without exposing private details here.')}</p>
        </div>
      </header>

      <div className="settings-wrap">
        <SettingsGroup title={tr('Account')}>
          <Row icon={<UserRound />} title={tr('Personal Profile')} sub={tr('Manage your personal account')} onClick={() => setScreen('profile')} />
          <Row icon={<Store />} title={tr('Business Profile')} sub={tr('Manage your store information')} onClick={() => setScreen('business')} />
          <Row icon={<ShieldCheck />} title={tr('Security & Login')} sub={tr('Password and phone security')} onClick={() => setScreen('security')} />
        </SettingsGroup>

        <SettingsGroup title={tr('Preferences')}>
          <Row icon={<Moon />} title={tr('Appearance')} sub={tr('Light, dark or system theme')} onClick={() => setScreen('appearance')} />
          <Row icon={<Languages />} title={tr('Language')} sub={tr('Choose the language OjaFlow should use across the app.')} onClick={() => setScreen('language')} />
          <Row icon={<Bell />} title={tr('Notifications')} sub={tr('Choose the alerts you want')} onClick={() => setScreen('notifications')} />
        </SettingsGroup>

        <SettingsGroup title={tr('Data')}>
          <Row icon={<Cloud />} title={tr('Backup & Sync')} sub={syncSubtitle(syncStatus, tr)} onClick={() => setScreen('sync')} />
          <Row icon={<Download />} title={tr('Export My Data')} sub={tr('JSON, CSV and business summary')} onClick={() => setScreen('export')} />
        </SettingsGroup>

        <SettingsGroup title={tr('Support & Legal')}>
          <Row icon={<CircleHelp />} title={tr('Help & Support')} sub={tr('FAQs and support ticket')} onClick={() => setScreen('help')} />
          <Row icon={<Info />} title={tr('About OjaFlow')} sub={tr('What OjaFlow is built to do')} onClick={() => setScreen('about')} />
          <Row icon={<FileText />} title={tr('Privacy Policy')} onClick={() => setScreen('privacy')} />
          <Row icon={<FileText />} title={tr('Terms of Use')} onClick={() => setScreen('terms')} />
        </SettingsGroup>

        <SettingsGroup title={tr('Session')}>
          <Row icon={<LogOut />} title={tr('Log Out')} onClick={() => setScreen('logout')} />
        </SettingsGroup>

        <SettingsGroup title={tr('Danger Zone')} danger>
          <Row icon={<Trash2 />} title={tr('Delete Account')} sub={tr('Permanent account removal')} onClick={() => setScreen('delete')} danger />
        </SettingsGroup>
      </div>
    </>
  );
}

function syncSubtitle(status: SyncStatus, tr: (key: string) => string) {
  if (status === 'syncing') return tr('Syncing your latest changes');
  if (status === 'synced') return tr('Your cloud data is up to date');
  if (status === 'offline') return tr('Offline — changes remain available locally');
  if (status === 'error') return tr('A sync issue needs attention');
  return tr('Real-time cloud backup');
}

function SettingsGroup({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`settings-group ${danger ? 'danger-group' : ''}`}>
      <h3>{title}</h3>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function Row({
  icon,
  title,
  sub,
  onClick,
  danger
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button className={`settings-row ${danger ? 'danger-text' : ''}`} onClick={onClick}>
      <div className="settings-icon">{icon}</div>
      <div className="grow">
        <strong>{title}</strong>
        {sub && <span>{sub}</span>}
      </div>
      <ChevronRight size={19} />
    </button>
  );
}

function SimpleScreen({ title, subtitle, onBack, children }: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { tr } = useI18n();
  return (
    <>
      <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /> {tr('Settings')}</button>
      <header className="page-head compact-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      <div className="panel settings-detail">{children}</div>
    </>
  );
}

function Reauth({ onVerified }: { onVerified: () => void }) {
  const { tr } = useI18n();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.verifyPassword(password);
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Verification failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reauth">
      <div className="round-icon"><ShieldCheck /></div>
      <h2>{tr('Confirm it’s you')}</h2>
      <p className="muted">{tr('Enter your password before changing sensitive account information.')}</p>
      <label>
        {tr('Password')}
        <div className="password-field">
          <input value={password} onChange={event => setPassword(event.target.value)} type={show ? 'text' : 'password'} />
          <button type="button" onClick={() => setShow(value => !value)}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-btn full" disabled={busy || !password} onClick={submit}>
        {busy ? tr('Checking…') : tr('Continue')}
      </button>
    </div>
  );
}

function ProfileScreen({ profile, onSave, onBack }: {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onBack: () => void;
}) {
  const { tr } = useI18n();
  const [editing, setEditing] = useState(false);
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState('');

  if (editing && !verified) {
    return (
      <SimpleScreen title={tr('Edit Personal Profile')} subtitle={tr('Sensitive changes require confirmation.')} onBack={onBack}>
        <Reauth onVerified={() => setVerified(true)} />
      </SimpleScreen>
    );
  }

  return (
    <SimpleScreen title={tr('Personal Profile')} subtitle={tr('Your private account information.')} onBack={onBack}>
      {editing ? (
        <form className="form-stack" onSubmit={event => {
          event.preventDefault();
          void (async () => {
            setStatus(tr('Saving…'));
            const form = new FormData(event.currentTarget);
            const next = {
              ...profile,
              firstName: String(form.get('firstName') || '').trim(),
              lastName: String(form.get('lastName') || '').trim(),
              otherName: String(form.get('otherName') || '').trim(),
              preferredLanguage: String(form.get('preferredLanguage') || 'en') as LanguagePreference
            };
            try {
              await api.saveProfile(next);
              onSave(next);
              setStatus(tr('Saved'));
              setEditing(false);
              setVerified(false);
            } catch (e) {
              setStatus(e instanceof Error ? e.message : tr('Could not save changes.'));
            }
          })();
        }}>
          <div className="two-col">
            <label>{tr('First name')}<input name="firstName" defaultValue={profile.firstName} required /></label>
            <label>{tr('Surname')}<input name="lastName" defaultValue={profile.lastName} required /></label>
          </div>
          <label>{tr('Other name')}<input name="otherName" defaultValue={profile.otherName || ''} /></label>
          <label>{tr('Language')}<select name="preferredLanguage" defaultValue={profile.preferredLanguage || 'en'}>{languageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>{tr('Registered phone')}<input value={maskPhone(profile.phoneNumber)} disabled /></label>
          {status && <div className="inline-status">{status}</div>}
          <button className="primary-btn">{tr('Save changes')}</button>
        </form>
      ) : (
        <>
          <div className="profile-summary">
            <div className="avatar large-avatar">{profile.firstName[0]}{profile.lastName[0]}</div>
            <div>
              <strong>{profile.firstName} {profile.lastName}</strong>
              <span>{maskPhone(profile.phoneNumber)} • {languageLabel(profile.preferredLanguage)}</span>
            </div>
          </div>
          <div className="privacy-note"><ShieldCheck size={18} /> {tr('Your full phone number is hidden unless it is required for a secure action.')}</div>
          <button className="primary-btn" onClick={() => setEditing(true)}>{tr('Edit profile')}</button>
        </>
      )}
    </SimpleScreen>
  );
}

function BusinessScreen({ profile, business, onSave, onBack }: {
  profile: UserProfile;
  business: BusinessProfile;
  onSave: (business: BusinessProfile) => void;
  onBack: () => void;
}) {
  const { tr } = useI18n();
  const [editing, setEditing] = useState(false);
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState('');

  if (editing && !verified) {
    return (
      <SimpleScreen title={tr('Edit Business Profile')} subtitle={tr('Confirm your identity before making changes.')} onBack={onBack}>
        <Reauth onVerified={() => setVerified(true)} />
      </SimpleScreen>
    );
  }

  return (
    <SimpleScreen title={tr('Business Profile')} subtitle={tr('Information OjaFlow uses to personalize your workspace.')} onBack={onBack}>
      {editing ? (
        <form className="form-stack" onSubmit={event => {
          event.preventDefault();
          void (async () => {
            setStatus(tr('Saving…'));
            const form = new FormData(event.currentTarget);
            const next: BusinessProfile = {
              ...business,
              businessName: String(form.get('businessName') || '').trim(),
              category: String(form.get('category') || '').trim(),
              phone: String(form.get('phone') || '').trim(),
              address: String(form.get('address') || '').trim()
            };
            try {
              await api.saveProfile(profile, next);
              onSave(next);
              setStatus(tr('Saved'));
              setEditing(false);
              setVerified(false);
            } catch (e) {
              setStatus(e instanceof Error ? e.message : tr('Could not save changes.'));
            }
          })();
        }}>
          <label>{tr('Business name')}<input name="businessName" defaultValue={business.businessName} required /></label>
          <label>{tr('Category')}<input name="category" defaultValue={business.category} required /></label>
          <label>{tr('Business phone')}<input name="phone" defaultValue={business.phone} required /></label>
          <label>{tr('Address')}<input name="address" defaultValue={business.address} required /></label>
          {status && <div className="inline-status">{status}</div>}
          <button className="primary-btn">{tr('Save business')}</button>
        </form>
      ) : (
        <>
          <div className="detail-list">
            <div><span>{tr('Business name')}</span><strong>{business.businessName}</strong></div>
            <div><span>{tr('Category')}</span><strong>{business.category}</strong></div>
            <div><span>{tr('Phone')}</span><strong>{maskPhone(business.phone)}</strong></div>
            <div><span>{tr('Address')}</span><strong>{business.address}</strong></div>
          </div>
          <button className="primary-btn" onClick={() => setEditing(true)}>{tr('Edit business')}</button>
        </>
      )}
    </SimpleScreen>
  );
}

function SecurityScreen({ profile, onBack, onChangePassword }: {
  profile: UserProfile;
  onBack: () => void;
  onChangePassword: () => void;
}) {
  const { tr } = useI18n();
  return (
    <SimpleScreen title={tr('Security & Login')} subtitle={tr('Protect access to your OjaFlow account.')} onBack={onBack}>
      <div className="security-summary">
        <div className="security-badge"><ShieldCheck /></div>
        <div>
          <strong>{tr('Account phone')}</strong>
          <span>{maskPhone(profile.phoneNumber)}</span>
        </div>
      </div>
      <div className="settings-action-list">
        <button onClick={onChangePassword}>
          <span><KeyRound size={18} /><b>{tr('Change password')}</b></span>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="info-card compact-info">
        <strong>{tr('Phone number changes')}</strong>
        <p>{tr('Changing the registered phone number is not available from the profile screen yet.')}</p>
      </div>
    </SimpleScreen>
  );
}

function ChangePasswordScreen({ onBack }: { onBack: () => void }) {
  const { tr } = useI18n();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <SimpleScreen title={tr('Change Password')} subtitle={tr('Use a strong password you do not reuse elsewhere.')} onBack={onBack}>
      <form className="form-stack" onSubmit={event => {
        event.preventDefault();
        void (async () => {
          const form = new FormData(event.currentTarget);
          const currentPassword = String(form.get('currentPassword') || '');
          const newPassword = String(form.get('newPassword') || '');
          const confirm = String(form.get('confirm') || '');
          if (newPassword.length < 8) return setStatus(tr('New password must contain at least 8 characters.'));
          if (newPassword !== confirm) return setStatus(tr('New passwords do not match.'));
          setBusy(true);
          setStatus('');
          try {
            await api.changePassword(currentPassword, newPassword);
            event.currentTarget.reset();
            setStatus(tr('Password changed successfully.'));
          } catch (e) {
            setStatus(e instanceof Error ? e.message : tr('Could not change password.'));
          } finally {
            setBusy(false);
          }
        })();
      }}>
        <label>{tr('Current password')}<input name="currentPassword" type={show ? 'text' : 'password'} required /></label>
        <label>{tr('New password')}<input name="newPassword" type={show ? 'text' : 'password'} minLength={8} required /></label>
        <label>{tr('Confirm new password')}<input name="confirm" type={show ? 'text' : 'password'} minLength={8} required /></label>
        <button className="text-btn form-text-button" type="button" onClick={() => setShow(value => !value)}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />} {show ? tr('Hide passwords') : tr('Show passwords')}
        </button>
        {status && <div className="inline-status">{status}</div>}
        <button className="primary-btn" disabled={busy}>{busy ? tr('Updating…') : tr('Update password')}</button>
      </form>
    </SimpleScreen>
  );
}

function AppearanceScreen({ theme, setTheme, onBack }: {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  onBack: () => void;
}) {
  const { tr } = useI18n();
  const options: Array<{ id: ThemePreference; title: string; text: string; icon: React.ReactNode }> = [
    { id: 'light', title: tr('Light'), text: tr('Bright, clean workspace'), icon: <Sun /> },
    { id: 'dark', title: tr('Dark'), text: tr('Comfortable in low light'), icon: <Moon /> },
    { id: 'system', title: tr('System'), text: tr('Follow your device setting'), icon: <Monitor /> }
  ];

  return (
    <SimpleScreen title={tr('Appearance')} subtitle={tr('Choose how OjaFlow looks on this device.')} onBack={onBack}>
      <div className="choice-list visual-choices">
        {options.map(option => (
          <button key={option.id} className={theme === option.id ? 'choice active' : 'choice'} onClick={() => setTheme(option.id)}>
            <span className="choice-icon">{option.icon}</span>
            <span className="grow"><b>{option.title}</b><small>{option.text}</small></span>
            {theme === option.id && <Check size={18} />}
          </button>
        ))}
      </div>
    </SimpleScreen>
  );
}


function LanguageScreen({
  profile,
  business,
  onSave,
  onBack
}: {
  profile: UserProfile;
  business: BusinessProfile;
  onSave: (profile: UserProfile) => void;
  onBack: () => void;
}) {
  const { tr } = useI18n();
  const [selected, setSelected] = useState<LanguagePreference>(profile.preferredLanguage || 'en');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveLanguage() {
    setBusy(true);
    setStatus('');
    const next: UserProfile = { ...profile, preferredLanguage: selected };

    try {
      const remote = await api.saveProfile(next, business);
      onSave(remote.profile);
      setStatus(tr('Saved'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr('Could not save changes.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SimpleScreen
      title={tr('Language')}
      subtitle={tr('Changes apply immediately across OjaFlow.')}
      onBack={onBack}
    >
      <div className="language-settings-grid">
        {languageOptions.map(option => (
          <button
            type="button"
            key={option.value}
            className={selected === option.value ? 'language-choice active' : 'language-choice'}
            onClick={() => setSelected(option.value)}
          >
            <span className="language-choice-code">{option.short}</span>
            <span className="grow">
              <strong>{option.label}</strong>
              <small>{selected === option.value ? tr('Selected') : tr('Tap to select')}</small>
            </span>
            {selected === option.value && <Check size={18} />}
          </button>
        ))}
      </div>

      {status && <div className="inline-status">{status}</div>}

      <button
        className="primary-btn"
        disabled={busy || selected === profile.preferredLanguage}
        onClick={() => void saveLanguage()}
      >
        {busy ? tr('Saving…') : tr('Save language')}
      </button>
    </SimpleScreen>
  );
}

function NotificationsScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { tr } = useI18n();
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => loadNotifications(uid));
  const [permission, setPermission] = useState<NotificationPermission>(() => Notification.permission);

  function change(key: keyof NotificationPreferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    saveNotifications(uid, next);
  }

  async function enableBrowserNotifications() {
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <SimpleScreen title={tr('Notifications')} subtitle={tr('Choose which business signals should get your attention.')} onBack={onBack}>
      <Toggle label={tr('Low-stock alerts')} description={tr('Know when products reach their reorder level.')} on={preferences.lowStock} onChange={() => change('lowStock')} />
      <Toggle label={tr('Debt reminders')} description={tr('Keep outstanding customer debts visible.')} on={preferences.debtReminders} onChange={() => change('debtReminders')} />
      <Toggle label={tr('Daily business summary')} description={tr('Prepare a daily summary preference for future scheduled alerts.')} on={preferences.dailySummary} onChange={() => change('dailySummary')} />
      <Toggle label={tr('Sync problems')} description={tr('Warn when cloud backup needs attention.')} on={preferences.syncProblems} onChange={() => change('syncProblems')} />
      <div className="info-card">
        <strong>{tr('Browser permission')}: {permission}</strong>
        <p>{tr("Your OjaFlow notification preferences are saved on this device. Browser notifications also require your browser's permission.")}</p>
        {permission !== 'granted' && <button className="secondary-btn" onClick={enableBrowserNotifications}>{tr('Enable browser notifications')}</button>}
      </div>
    </SimpleScreen>
  );
}

function Toggle({ label, description, on, onChange }: {
  label: string;
  description: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <button className="toggle-row" onClick={onChange}>
      <span><strong>{label}</strong><small>{description}</small></span>
      <span className={`toggle ${on ? 'on' : ''}`}><i /></span>
    </button>
  );
}

function SyncScreen({ syncStatus, lastSync, onSyncNow, onBack }: {
  syncStatus: SyncStatus;
  lastSync: string | null;
  onSyncNow: () => Promise<void>;
  onBack: () => void;
}) {
  const { tr, locale } = useI18n();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    setMessage('');
    try {
      await onSyncNow();
      setMessage(tr('Your local records have been pushed to the cloud.'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tr('Sync failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SimpleScreen title={tr('Backup & Sync')} subtitle={tr('OjaFlow keeps a local copy and synchronizes signed-in business records with your cloud backend.')} onBack={onBack}>
      <div className={`sync-status-card ${syncStatus}`}>
        <div className="sync-orb"><Cloud /></div>
        <div>
          <span>{tr('Current status')}</span>
          <strong>{syncSubtitle(syncStatus, tr)}</strong>
          <small>{lastSync ? tr('Last successful sync: {date}', { date: new Date(lastSync).toLocaleString(locale) }) : tr('No completed sync recorded yet.')}</small>
        </div>
      </div>
      <div className="info-card">
        <strong>{tr('How it works')}</strong>
        <p>{tr('Changes are saved locally first. When you are online, OjaFlow synchronizes them to your cloud database.')}</p>
      </div>
      {message && <div className="inline-status">{message}</div>}
      <button className="primary-btn" onClick={sync} disabled={busy || syncStatus === 'offline'}>
        <RefreshCw size={17} className={busy ? 'spin' : ''} /> {busy ? tr('Syncing…') : tr('Sync now')}
      </button>
    </SimpleScreen>
  );
}

function ExportScreen({ profile, business, data, onBack }: {
  profile: UserProfile;
  business: BusinessProfile;
  data: StoreData;
  onBack: () => void;
}) {
  const { tr } = useI18n();
  return (
    <SimpleScreen title={tr('Export My Data')} subtitle={tr('Keep a portable copy of your business records.')} onBack={onBack}>
      <div className="export-grid">
        <button className="export-card" onClick={() => exportAllAsJson(profile, business, data)}>
          <Download />
          <div><strong>{tr('Full JSON backup')}</strong><span>{tr('Best for restoring, migration or technical backup.')}</span></div>
        </button>
        <button className="export-card" onClick={() => exportAllAsCsv(data)}>
          <FileText />
          <div><strong>{tr('CSV spreadsheets')}</strong><span>{tr('Downloads sales, expenses, inventory, debts and customers.')}</span></div>
        </button>
        <button className="export-card" onClick={() => exportSummary(business, data, profile.preferredLanguage)}>
          <FileText />
          <div><strong>{tr('Business summary')}</strong><span>{tr('A simple text snapshot you can keep or share.')}</span></div>
        </button>
      </div>
      <div className="privacy-note"><ShieldCheck size={18} /> {tr('Exports are created in your browser and downloaded directly to your device.')}</div>
    </SimpleScreen>
  );
}

function HelpScreen({ onBack }: { onBack: () => void }) {
  const { tr } = useI18n();
  const [status, setStatus] = useState('');
  const faqs = [
    ['Why is my sale not showing on another device?', 'Check Backup & Sync and confirm both devices are signed into the same OjaFlow account.'],
    ['Can I use OjaFlow when internet is poor?', 'Yes. OjaFlow keeps local records and automatically synchronizes them with the OjaFlow backend when connectivity returns.'],
    ['Why does OjaChat sometimes need internet?', 'Questions calculated directly from your records work locally. Broader business advice is generated by the online OjaChat adviser.'],
    ['How do I keep a copy of my records?', 'Open Settings → Export My Data and download JSON or CSV files.']
  ];

  return (
    <SimpleScreen title={tr('Help & Support')} subtitle={tr('Find an answer or send a support ticket from inside OjaFlow.')} onBack={onBack}>
      <div className="faq-list">
        {faqs.map(([question, answer]) => <details key={question}><summary>{tr(question)}</summary><p>{tr(answer)}</p></details>)}
      </div>
      <div className="support-form-wrap">
        <h3>{tr('Still need help?')}</h3>
        <form className="form-stack" onSubmit={event => {
          event.preventDefault();
          void (async () => {
            const form = new FormData(event.currentTarget);
            setStatus(tr('Sending…'));
            try {
              await api.supportTicket(
                String(form.get('category') || 'General'),
                String(form.get('subject') || '').trim(),
                String(form.get('message') || '').trim()
              );
              event.currentTarget.reset();
              setStatus(tr('Support ticket submitted successfully.'));
            } catch (e) {
              setStatus(e instanceof Error ? e.message : tr('Could not submit support ticket.'));
            }
          })();
        }}>
          <label>{tr('Category')}<select name="category"><option>Account & Login</option><option>Sales & Records</option><option>Sync & Backup</option><option>OjaChat</option><option>General</option></select></label>
          <label>{tr('Subject')}<input name="subject" required /></label>
          <label>{tr('What happened?')}<textarea name="message" rows={5} required /></label>
          {status && <div className="inline-status">{status}</div>}
          <button className="primary-btn">{tr('Submit support ticket')}</button>
        </form>
      </div>
    </SimpleScreen>
  );
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  const { tr } = useI18n();
  return (
    <SimpleScreen title={tr('About OjaFlow')} subtitle={tr('Business clarity for everyday trade.')} onBack={onBack}>
      <div className="about-hero">
        <span className="brand-mark giant">O</span>
        <div><strong>OjaFlow</strong><span>Version 1.1</span></div>
      </div>
      <p className="legal-copy">{tr('OjaFlow is designed to help small traders understand and manage sales, stock, expenses, customers and credit without requiring complex accounting software.')}</p>
      <div className="about-values">
        <div><strong>{tr('Simple by design')}</strong><span>{tr('Everyday business language instead of accounting jargon.')}</span></div>
        <div><strong>{tr('Local-first')}</strong><span>{tr('Fast record keeping with cloud synchronization for signed-in users.')}</span></div>
        <div><strong>{tr('Trader-aware AI')}</strong><span>{tr('OjaChat combines your store context with broader practical business guidance.')}</span></div>
        <div><strong>{tr('Privacy-conscious')}</strong><span>{tr('Sensitive information stays behind dedicated account and security screens.')}</span></div>
      </div>
    </SimpleScreen>
  );
}

function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const { tr } = useI18n();
  return (
    <SimpleScreen title={tr('Privacy Policy')} subtitle={tr('How OjaFlow handles account and business information.')} onBack={onBack}>
      <div className="legal-copy">
        <h3>{tr('Information OjaFlow uses')}</h3>
        <p>{tr('OjaFlow processes the account information you provide, including your phone number, profile details, business profile and the business records you create in the app.')}</p>
        <h3>{tr('Why the information is used')}</h3>
        <p>{tr('Your information is used to authenticate your account, display your workspace, synchronize records, calculate summaries and give OjaChat relevant business context.')}</p>
        <h3>{tr('Passwords and account security')}</h3>
        <p>{tr('Plaintext passwords are not stored in ordinary app records. Phone ownership is not currently verified by SMS in this MVP.')}</p>
        <h3>{tr('Exports')}</h3>
        <p>{tr('When you export data, OjaFlow creates the requested file in your browser for download to your device.')}</p>
        <h3>{tr('Before public launch')}</h3>
        <p>{tr('This product policy should be reviewed before OjaFlow is released commercially.')}</p>
      </div>
    </SimpleScreen>
  );
}

function TermsScreen({ onBack }: { onBack: () => void }) {
  const { tr } = useI18n();
  return (
    <SimpleScreen title={tr('Terms of Use')} subtitle={tr('Basic terms for using OjaFlow.')} onBack={onBack}>
      <div className="legal-copy">
        <h3>{tr('Your records')}</h3>
        <p>{tr('You are responsible for checking the accuracy of records entered into OjaFlow.')}</p>
        <h3>OjaChat</h3>
        <p>{tr('OjaChat provides informational business guidance and does not replace professional legal, tax, accounting or regulated financial advice.')}</p>
        <h3>{tr('Account security')}</h3>
        <p>{tr('Keep your password secure. Sensitive account changes require password re-entry and explicit confirmation.')}</p>
        <h3>{tr('Service availability')}</h3>
        <p>{tr('Some features depend on third-party infrastructure and internet connectivity.')}</p>
        <h3>{tr('Before commercial release')}</h3>
        <p>{tr('These product terms should receive appropriate legal review before a public commercial launch.')}</p>
      </div>
    </SimpleScreen>
  );
}

function LogoutScreen({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) {
  const { tr } = useI18n();
  return (
    <SimpleScreen title={tr('Log Out')} subtitle={tr('End this session on the current device.')} onBack={onBack}>
      <div className="confirmation-card">
        <div className="round-icon"><LogOut /></div>
        <h2>{tr('Log out of OjaFlow?')}</h2>
        <p>{tr('Your cloud business data will stay associated with your account. You will need your phone number and password to sign in again.')}</p>
        <div className="confirmation-actions">
          <button className="secondary-btn" onClick={onBack}>{tr('Cancel')}</button>
          <button className="primary-btn" onClick={onLogout}>{tr('Log out')}</button>
        </div>
      </div>
    </SimpleScreen>
  );
}

function DeleteScreen({ profile, onBack, onDelete }: {
  profile: UserProfile;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { tr } = useI18n();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const phrase = 'DELETE MY ACCOUNT';
  const ready =
    password.length > 0 &&
    confirmation.trim().toUpperCase() === phrase &&
    understood;

  async function remove() {
    if (!ready) return;

    setBusy(true);

    try {
      setError('');

      await api.deleteAccount(
        password,
        confirmation
      );

      onDelete();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Deletion failed.')
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SimpleScreen
      title={tr('Delete Account')}
      subtitle={tr('Permanent removal requires your password and explicit confirmation.')}
      onBack={onBack}
    >
      <div className="danger-box">
        <Trash2 />
        <div>
          <strong>{tr('This is permanent')}</strong>
          <p>
            {tr('Export important records first. Deleting your account removes your profile, business profile and cloud business records.')}
          </p>
        </div>
      </div>

      <div className="form-stack">
        <label>
          {tr('Account')}
          <input
            value={`${profile.firstName} ${profile.lastName} • ${maskPhone(profile.phoneNumber)}`}
            disabled
          />
        </label>

        <label>
          {tr('Enter your current password')}
          <input
            type="password"
            value={password}
            onChange={event =>
              setPassword(event.target.value)
            }
            autoComplete="current-password"
          />
        </label>

        <div className="delete-confirmation-copy">
          <strong>{tr('Type this phrase exactly:')}</strong>
          <code>{phrase}</code>
        </div>

        <label>
          {tr('Confirmation phrase')}
          <input
            value={confirmation}
            onChange={event =>
              setConfirmation(event.target.value)
            }
            placeholder={phrase}
            autoComplete="off"
          />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={understood}
            onChange={event =>
              setUnderstood(event.target.checked)
            }
          />
          {tr('I understand that this account deletion is permanent and cannot be undone.')}
        </label>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <button
          className="danger-btn"
          disabled={!ready || busy}
          onClick={() => void remove()}
        >
          {busy
            ? tr('Deleting…')
            : tr('Delete Account Permanently')}
        </button>
      </div>
    </SimpleScreen>
  );
}
