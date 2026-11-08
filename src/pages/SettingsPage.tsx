import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  Copy,
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
  SupportTicketItem,
  SyncStatus,
  ThemePreference,
  UserProfile
} from '../types';
import { maskPhone } from '../lib/phone';
import { copyText } from '../lib/clipboard';
import { api } from '../lib/api';
import { loadNotifications, saveNotifications } from '../lib/storage';
import { languageLabel, languageOptions } from '../lib/language';
import { useI18n } from '../lib/i18n';
import type { LanguagePreference } from '../types';
import {
  LOCALIZED_ANSWER_PLACEHOLDERS,
  LOCALIZED_CUSTOM_QUESTION_PLACEHOLDERS,
  LOCALIZED_TRADER_SECURITY_QUESTIONS
} from '../lib/securityQuestions';

const PIN_REGEX = /^\d{4}$/;

type Screen =
  | 'root'
  | 'profile'
  | 'business'
  | 'security'
  | 'password'
  | 'security-question'
  | 'appearance'
  | 'language'
  | 'notifications'
  | 'sync'
  | 'export'
  | 'help'
  | 'about'
  | 'logout'
  | 'delete';

type LegalPage = 'terms' | 'privacy' | 'faq';

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
  onSyncNow,
  setLegalPage
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
  setLegalPage: (page: LegalPage) => void;
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
    return (
      <SecurityScreen
        profile={profile}
        onBack={back}
        onChangePassword={() => setScreen('password')}
        onChangeSecurityQuestion={() => setScreen('security-question')}
      />
    );
  }
  if (screen === 'password') {
    return <ChangePasswordScreen onBack={() => setScreen('security')} />;
  }
  if (screen === 'security-question') {
    return (
      <SecurityQuestionScreen
        profile={profile}
        onSave={onProfile}
        onBack={() => setScreen('security')}
      />
    );
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
    return <HelpScreen onBack={back} onOpenFaq={() => setLegalPage('faq')} />;
  }
  if (screen === 'about') {
    return <AboutScreen onBack={back} />;
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
          <Row icon={<ShieldCheck />} title={tr('Security & Login')} sub={tr('4-digit PIN and phone security')} onClick={() => setScreen('security')} />
        </SettingsGroup>

        <SettingsGroup title={tr('Preferences')}>
          <Row icon={<Moon />} title={tr('Appearance')} sub={tr('Light, dark or system theme')} onClick={() => setScreen('appearance')} />
          <Row icon={<Languages />} title={tr('Language')} sub={tr('Choose the language OjaFlow should use across the app.')} onClick={() => setScreen('language')} />
          <Row icon={<Bell />} title={tr('Notifications')} sub={tr('Choose the alerts you want')} onClick={() => setScreen('notifications')} />
        </SettingsGroup>

        <SettingsGroup title={tr('Data')}>
          <Row icon={<Cloud />} title={tr('Backup & Sync')} sub={syncSubtitle(syncStatus, tr)} onClick={() => setScreen('sync')} />
          <Row icon={<Download />} title={tr('Export My Data')} sub={tr('Download a backup, spreadsheets or a business summary')} onClick={() => setScreen('export')} />
        </SettingsGroup>

        <SettingsGroup title={tr('Support & Legal')}>
          <Row icon={<CircleHelp />} title={tr('Help & Support')} sub={tr('FAQs and support ticket')} onClick={() => setScreen('help')} />
          <Row icon={<CircleHelp />} title={tr('Help & FAQs')} onClick={() => setLegalPage('faq')} />
          <Row icon={<Info />} title={tr('About OjaFlow')} sub={tr('What OjaFlow is built to do')} onClick={() => setScreen('about')} />
          <Row icon={<FileText />} title={tr('Privacy Policy')} onClick={() => setLegalPage('privacy')} />
          <Row icon={<FileText />} title={tr('Terms and Conditions')} onClick={() => setLegalPage('terms')} />
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
  if (status === 'synced') return tr('Your latest records are saved to your account');
  if (status === 'offline') return tr('Offline — changes remain available locally');
  if (status === 'error') return tr('A sync issue needs attention');
  return tr('Your records are saved to your account when connected');
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
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!PIN_REGEX.test(pin)) {
      setError(tr('Enter your 4-digit PIN.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.verifyPassword(pin);
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
      <p className="muted">{tr('Enter your 4-digit PIN before changing sensitive account information.')}</p>
      <label>
        {tr('4-digit PIN')}
        <div className="password-field">
          <input
            value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="••••"
          />
          <button type="button" onClick={() => setShow(value => !value)}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-btn full" disabled={busy || pin.length !== 4} onClick={submit}>
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
  const [tagStatus, setTagStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function copyOjaTag() {
    try {
      await copyText(profile.ojaTag);
      setTagStatus({ kind: 'success', text: tr('Copied') });
    } catch (error) {
      setTagStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : tr('Could not copy OjaTag.')
      });
    }
  }

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
          <div className="detail-list">
            <div>
              <span>{tr('Your unique OjaTag')}</span>
              <strong>{profile.ojaTag || tr('Unavailable')}</strong>
            </div>
          </div>
          <p className="field-help">{tr('Share this tag or use it to log in.')}</p>
          <button type="button" className="secondary-btn" disabled={!profile.ojaTag} onClick={() => void copyOjaTag()}>
            {tagStatus?.kind === 'success' ? <Check size={17} /> : <Copy size={17} />}
            {tagStatus?.kind === 'success' ? tr('Copied') : tr('Copy')}
          </button>
          {tagStatus && <div className={tagStatus.kind === 'success' ? 'inline-status' : 'form-error'}>{tagStatus.text}</div>}
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

function SecurityScreen({
  profile,
  onBack,
  onChangePassword,
  onChangeSecurityQuestion
}: {
  profile: UserProfile;
  onBack: () => void;
  onChangePassword: () => void;
  onChangeSecurityQuestion: () => void;
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
          <span><KeyRound size={18} /><b>{tr('Change 4-digit PIN')}</b></span>
          <ChevronRight size={18} />
        </button>
        <button onClick={onChangeSecurityQuestion}>
          <span>
            <ShieldCheck size={18} />
            <b>{tr('PIN Recovery Security Question')}</b>
          </span>
          <ChevronRight size={18} />
        </button>
      </div>
      {profile.securityQuestion && (
        <div className="info-card compact-info">
          <strong>{tr('Current security question')}</strong>
          <p>{profile.securityQuestion}</p>
        </div>
      )}
      <div className="info-card compact-info">
        <strong>{tr('Phone number changes')}</strong>
        <p>{tr('Changing the registered phone number is not available from the profile screen yet.')}</p>
      </div>
    </SimpleScreen>
  );
}

function SecurityQuestionScreen({
  profile,
  onSave,
  onBack
}: {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onBack: () => void;
}) {
  const { tr } = useI18n();
  const lang: LanguagePreference = profile.preferredLanguage || 'en';
  const localizedQuestions =
    LOCALIZED_TRADER_SECURITY_QUESTIONS[lang] ||
    LOCALIZED_TRADER_SECURITY_QUESTIONS.en;
  const allPresetQuestions = Object.values(
    LOCALIZED_TRADER_SECURITY_QUESTIONS
  ).flat();

  const [questionChoice, setQuestionChoice] = useState<string>(
    profile.securityQuestion &&
      localizedQuestions.includes(profile.securityQuestion)
      ? profile.securityQuestion
      : profile.securityQuestion &&
          !allPresetQuestions.includes(profile.securityQuestion)
        ? '__custom__'
        : localizedQuestions[0]
  );
  const [customQuestion, setCustomQuestion] = useState<string>(
    profile.securityQuestion &&
      !allPresetQuestions.includes(profile.securityQuestion)
      ? profile.securityQuestion
      : ''
  );
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  function digitsOnly(event: React.FormEvent<HTMLInputElement>) {
    const cleaned = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
    if (event.currentTarget.value !== cleaned) {
      event.currentTarget.value = cleaned;
    }
  }

  return (
    <SimpleScreen
      title={tr('PIN Recovery Security Question')}
      subtitle={tr('Set a personal trade question so you can recover your 4-digit PIN for free anytime.')}
      onBack={onBack}
    >
      <form
        className="form-stack"
        onSubmit={event => {
          event.preventDefault();
          const formEl = event.currentTarget;
          void (async () => {
            const form = new FormData(formEl);
            const currentPin = String(form.get('currentPin') || '').trim();
            const securityAnswer = String(form.get('securityAnswer') || '').trim();
            const finalQuestion = (
              questionChoice === '__custom__' ? customQuestion : questionChoice
            ).trim();

            if (!PIN_REGEX.test(currentPin)) {
              setStatus(tr('Enter your current 4-digit PIN.'));
              return;
            }
            if (finalQuestion.length < 5) {
              setStatus(tr('Choose or write a valid security question.'));
              return;
            }
            if (securityAnswer.length < 2) {
              setStatus(tr('Security answer must be at least 2 characters.'));
              return;
            }

            setBusy(true);
            setStatus('');
            try {
              const result = await api.updateSecurityQuestion({
                currentPin,
                securityQuestion: finalQuestion,
                securityAnswer,
                preferredLanguage: lang
              });
              onSave(result.profile);
              formEl.reset();
              setStatus(tr('Security question and answer updated.'));
            } catch (e) {
              setStatus(e instanceof Error ? e.message : tr('Could not update security question.'));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <label>
          {tr('Security question')}
          <select
            value={questionChoice}
            onChange={event => setQuestionChoice(event.target.value)}
          >
            {localizedQuestions.map(question => (
              <option key={question} value={question}>
                {question}
              </option>
            ))}
            <option value="__custom__">
              {tr('Write my own personal trade question…')}
            </option>
          </select>
        </label>

        {questionChoice === '__custom__' && (
          <label>
            {tr('Your custom security question (any language or dialect)')}
            <input
              value={customQuestion}
              onChange={event => setCustomQuestion(event.target.value)}
              placeholder={LOCALIZED_CUSTOM_QUESTION_PLACEHOLDERS[lang]}
              minLength={5}
              maxLength={255}
              required
            />
          </label>
        )}

        <label>
          {tr('Security answer')}
          <input
            name="securityAnswer"
            type="text"
            autoComplete="off"
            placeholder={LOCALIZED_ANSWER_PLACEHOLDERS[lang]}
            minLength={2}
            maxLength={160}
            required
          />
        </label>

        <label>
          {tr('Current 4-digit PIN')}
          <input
            name="currentPin"
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            minLength={4}
            maxLength={4}
            placeholder="••••"
            onInput={digitsOnly}
            required
          />
        </label>

        {status && <div className="inline-status">{status}</div>}
        <button className="primary-btn" disabled={busy}>
          {busy ? tr('Saving…') : tr('Save security question')}
        </button>
      </form>
    </SimpleScreen>
  );
}

function ChangePasswordScreen({ onBack }: { onBack: () => void }) {
  const { tr } = useI18n();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  function digitsOnly(event: React.FormEvent<HTMLInputElement>) {
    const cleaned = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
    if (event.currentTarget.value !== cleaned) {
      event.currentTarget.value = cleaned;
    }
  }

  return (
    <SimpleScreen title={tr('Change 4-digit PIN')} subtitle={tr('Choose a 4-digit PIN that is easy for you to remember and hard for others to guess.')} onBack={onBack}>
      <form className="form-stack" onSubmit={event => {
        event.preventDefault();
        const formEl = event.currentTarget;
        void (async () => {
          const form = new FormData(formEl);
          const currentPin = String(form.get('currentPassword') || '').trim();
          const newPin = String(form.get('newPassword') || '').trim();
          const confirm = String(form.get('confirm') || '').trim();
          if (!PIN_REGEX.test(currentPin)) return setStatus(tr('Current PIN must be 4 digits.'));
          if (!PIN_REGEX.test(newPin)) return setStatus(tr('New PIN must be exactly 4 digits.'));
          if (newPin !== confirm) return setStatus(tr('New PINs do not match.'));
          setBusy(true);
          setStatus('');
          try {
            await api.changePassword(currentPin, newPin);
            formEl.reset();
            setStatus(tr('4-digit PIN updated successfully.'));
          } catch (e) {
            setStatus(e instanceof Error ? e.message : tr('Could not change PIN.'));
          } finally {
            setBusy(false);
          }
        })();
      }}>
        <label>{tr('Current 4-digit PIN')}<input name="currentPassword" type={show ? 'text' : 'password'} inputMode="numeric" pattern="\d{4}" minLength={4} maxLength={4} placeholder="••••" onInput={digitsOnly} required /></label>
        <label>{tr('New 4-digit PIN')}<input name="newPassword" type={show ? 'text' : 'password'} inputMode="numeric" pattern="\d{4}" minLength={4} maxLength={4} placeholder="••••" onInput={digitsOnly} required /></label>
        <label>{tr('Confirm new 4-digit PIN')}<input name="confirm" type={show ? 'text' : 'password'} inputMode="numeric" pattern="\d{4}" minLength={4} maxLength={4} placeholder="••••" onInput={digitsOnly} required /></label>
        <button className="text-btn form-text-button" type="button" onClick={() => setShow(value => !value)}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />} {show ? tr('Hide PIN') : tr('Show PIN')}
        </button>
        {status && <div className="inline-status">{status}</div>}
        <button className="primary-btn" disabled={busy}>{busy ? tr('Updating…') : tr('Update 4-digit PIN')}</button>
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
    <SimpleScreen title={tr('Backup & Sync')} subtitle={tr('OjaFlow keeps a copy on this device and updates your account when an internet connection is available.')} onBack={onBack}>
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
        <button
          className="export-card"
          onClick={() => {
            void import('../lib/exportData').then(({ exportAllAsJson }) =>
              exportAllAsJson(profile, business, data)
            );
          }}
        >
          <Download />
          <div><strong>{tr('Full data backup')}</strong><span>{tr('Keep a complete copy of your business records.')}</span></div>
        </button>
        <button
          className="export-card"
          onClick={() => {
            void import('../lib/exportData').then(({ exportAllAsCsv }) =>
              exportAllAsCsv(data)
            );
          }}
        >
          <FileText />
          <div><strong>{tr('Spreadsheets')}</strong><span>{tr('Download your sales, expenses, stock, debts and customer records in spreadsheet files.')}</span></div>
        </button>
        <button
          className="export-card"
          onClick={() => {
            void import('../lib/exportData').then(({ exportSummary }) =>
              exportSummary(business, data, profile.preferredLanguage)
            );
          }}
        >
          <FileText />
          <div><strong>{tr('Business summary')}</strong><span>{tr('A simple text snapshot you can keep or share.')}</span></div>
        </button>
      </div>
      <div className="privacy-note"><ShieldCheck size={18} /> {tr('Exports are created in your browser and downloaded directly to your device.')}</div>
    </SimpleScreen>
  );
}

function HelpScreen({
  onBack,
  onOpenFaq
}: {
  onBack: () => void;
  onOpenFaq: () => void;
}) {
  const { tr } = useI18n();
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);

  useEffect(() => {
    void api
      .mySupportTickets()
      .then(res => setTickets(res.tickets || []))
      .catch(() => undefined);
  }, []);

  async function submitTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSending(true);
    setStatus(null);

    try {
      const result = await api.supportTicket(
        String(form.get('category') || 'General'),
        String(form.get('subject') || '').trim(),
        String(form.get('message') || '').trim()
      );
      formElement.reset();
      if (result.ticket) {
        setTickets(prev => [result.ticket!, ...prev]);
      } else {
        const refreshed = await api.mySupportTickets();
        setTickets(refreshed.tickets || []);
      }
      setStatus({
        kind: 'success',
        message: `${tr('Your request was saved. Reference number:')} ${result.ticketId}`
      });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : tr('Could not submit support request.')
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <SimpleScreen title={tr('Help & Support')} subtitle={tr('Get help with your account and business records.')} onBack={onBack}>
      <div className="support-help-card">
        <div>
          <strong>{tr('Browse help topics')}</strong>
          <p>{tr('Find guidance about accounts, sales, stock, privacy and more.')}</p>
        </div>
        <button type="button" className="secondary-btn" onClick={onOpenFaq}>
          {tr('View Help & FAQs')}
        </button>
      </div>

      <div className="support-form-wrap">
        <h3>{tr('Send a support request')}</h3>
        <p className="muted">
          {tr('Your request is sent directly to the OjaFlow Support team. When an administrator replies, you will receive an instant notification banner on your dashboard and see the reply below.')}
        </p>
        <form className="form-stack" onSubmit={event => void submitTicket(event)}>
          <label>
            {tr('What do you need help with?')}
            <select name="category" defaultValue="General">
              <option value="Account access">{tr('Account access')}</option>
              <option value="Sales and expenses">{tr('Sales and expenses')}</option>
              <option value="Products and stock">{tr('Products and stock')}</option>
              <option value="Customers and debts">{tr('Customers and debts')}</option>
              <option value="Data and syncing">{tr('Data and syncing')}</option>
              <option value="General">{tr('Something else')}</option>
            </select>
          </label>
          <label>
            {tr('Subject')}
            <input name="subject" minLength={2} maxLength={180} required />
          </label>
          <label>
            {tr('Describe the issue')}
            <textarea name="message" rows={5} minLength={5} maxLength={5000} required />
            <span className="field-help">{tr('Do not include your 4-digit PIN or verification code.')}</span>
          </label>
          {status && (
            <div className={status.kind === 'error' ? 'form-error' : 'inline-status'} role="status">
              {status.message}
            </div>
          )}
          <button className="primary-btn" disabled={sending}>
            {sending ? tr('Sending request…') : tr('Submit support request')}
          </button>
        </form>
      </div>

      {tickets.length > 0 && (
        <div className="support-tickets-history">
          <h3>{tr('Your Support Requests & Replies')}</h3>
          <div className="list">
            {tickets.map(ticket => (
              <div key={ticket.id} className="support-ticket-card">
                <div className="support-ticket-head">
                  <strong>{ticket.subject}</strong>
                  <span
                    className={`status-badge ${
                      ticket.status === 'answered' ? 'green' : 'amber'
                    }`}
                  >
                    {ticket.status === 'answered'
                      ? tr('Answered')
                      : ticket.status === 'closed'
                        ? tr('Closed')
                        : tr('Open')}
                  </span>
                </div>
                <small className="muted">
                  {ticket.category} • Ref: {ticket.id.slice(0, 8)}
                </small>
                <p className="support-ticket-msg">{ticket.message}</p>
                {ticket.adminReply && (
                  <div className="support-ticket-reply">
                    <strong>{tr('OjaFlow Admin Response:')}</strong>
                    <p>{ticket.adminReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </SimpleScreen>
  );
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  const { tr } = useI18n();
  return (
    <SimpleScreen title={tr('About OjaFlow')} subtitle={tr('Business clarity for everyday trade.')} onBack={onBack}>
      <div className="about-hero">
        <img
          src="/ojaflow-of.svg?v=1"
          alt="OjaFlow"
          className="brand-logo brand-logo-giant"
        />
        <div><strong>OjaFlow</strong><span>Version 1.1</span></div>
      </div>
      <p className="legal-copy">{tr('OjaFlow is designed to help small traders understand and manage sales, stock, expenses, customers and credit without requiring complex accounting software.')}</p>
      <div className="about-values">
        <div><strong>{tr('Simple by design')}</strong><span>{tr('Everyday business language instead of accounting jargon.')}</span></div>
        <div><strong>{tr('Available on your device')}</strong><span>{tr('Your records remain available on this device when you are offline.')}</span></div>
        <div><strong>{tr('Practical business guidance')}</strong><span>{tr('OjaChat can use relevant store information to offer general guidance.')}</span></div>
        <div><strong>{tr('Privacy-conscious')}</strong><span>{tr('Sensitive information stays behind dedicated account and security screens.')}</span></div>
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
        <p>{tr('Your cloud business data will stay associated with your account. You will need your phone number and 4-digit PIN to sign in again.')}</p>
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
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const phrase = 'DELETE MY ACCOUNT';
  const ready =
    PIN_REGEX.test(pin) &&
    confirmation.trim().toUpperCase() === phrase &&
    understood;

  async function remove() {
    if (!ready) return;

    setBusy(true);

    try {
      setError('');

      await api.deleteAccount(
        pin,
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
      subtitle={tr('Permanent removal requires your 4-digit PIN and explicit confirmation.')}
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
          {tr('Enter your current 4-digit PIN')}
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={event =>
              setPin(event.target.value.replace(/\D/g, '').slice(0, 4))
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
