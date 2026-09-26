import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { languageOptions, t } from '../lib/language';
import { normalizeNigerianPhone } from '../lib/phone';
import type { BusinessProfile, LanguagePreference, UserProfile } from '../types';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthPage({
  onAuthenticated
}: {
  onAuthenticated: (profile: UserProfile, business?: BusinessProfile | null) => void;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<LanguagePreference>('en');
  const tr = (key: string, vars?: Record<string, string | number>) => t(preferredLanguage, key, vars);

  async function login(form: HTMLFormElement) {
    const fd = new FormData(form);
    setBusy(true);
    setError('');

    try {
      const result = await api.loginPassword(
        normalizeNigerianPhone(String(fd.get('phone') || '')),
        String(fd.get('password') || '')
      );
      onAuthenticated(result.profile, result.business);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Could not sign in.'));
    } finally {
      setBusy(false);
    }
  }

  async function register(form: HTMLFormElement) {
    const fd = new FormData(form);
    const password = String(fd.get('password') || '');
    const confirm = String(fd.get('confirm') || '');

    if (password.length < 8) {
      setError(tr('Password must contain at least 8 characters.'));
      return;
    }

    if (password !== confirm) {
      setError(tr('Passwords do not match.'));
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await api.register({
        phone: normalizeNigerianPhone(String(fd.get('phone') || '')),
        firstName: String(fd.get('firstName') || '').trim(),
        lastName: String(fd.get('lastName') || '').trim(),
        otherName: String(fd.get('otherName') || '').trim(),
        password,
        preferredLanguage
      });
      onAuthenticated(result.profile, result.business);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Could not create your account.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      language={preferredLanguage}
      eyebrow={tr('BUILT FOR EVERYDAY TRADE')}
      heading={<>{tr('Know your numbers.')}<br />{tr('Run with confidence.')}</>}
      body={tr('Sales, stock, expenses, customers, debts and business guidance in one calm workspace.')}
    >
      <div className="auth-language-inline">
        <Globe2 size={16} />
        <select
          aria-label={tr('Language')}
          value={preferredLanguage}
          onChange={event => setPreferredLanguage(event.target.value as LanguagePreference)}
        >
          {languageOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="auth-tabs">
        <button
          className={mode === 'login' ? 'active' : ''}
          onClick={() => {
            setMode('login');
            setError('');
          }}
        >
          {tr('Log in')}
        </button>

        <button
          className={mode === 'register' ? 'active' : ''}
          onClick={() => {
            setMode('register');
            setError('');
          }}
        >
          {tr('Create account')}
        </button>
      </div>

      {mode === 'login' ? (
        <>
          <span className="eyebrow">{tr('WELCOME BACK')}</span>
          <h2>{tr('Continue to your business')}</h2>
          <p className="muted">{tr('Use your registered phone number and password.')}</p>

          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              void login(event.currentTarget);
            }}
          >
            <label>
              {tr('Phone number')}
              <div className="phone-field">
                <span>+234</span>
                <input name="phone" inputMode="tel" placeholder="801 234 5678" required />
              </div>
            </label>

            <label>
              {tr('Password')}
              <div className="password-field">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={tr('Your password')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? tr('Hide password') : tr('Show password')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button
              type="button"
              className="forgot-link"
              onClick={() => {
                setMode('forgot');
                setError('');
              }}
            >
              {tr('Forgot password?')}
            </button>

            {error && <div className="form-error">{error}</div>}

            <button disabled={busy} className="primary-btn full">
              {busy ? tr('Signing in…') : tr('Log in')} <ArrowRight size={18} />
            </button>
          </form>
        </>
      ) : mode === 'register' ? (
        <>
          <span className="eyebrow">{tr('NEW TO OJAFLOW?')}</span>
          <h2>{tr('Create your trader account')}</h2>

          <p className="muted">
            {tr('No email required. Your phone number is your login ID and your password protects the account.')}
          </p>

          <div className="auth-security-note">
            <ShieldCheck size={18} />
            <span>
              {tr('SMS verification is not required in this MVP. Double-check your phone number before creating the account.')}
            </span>
          </div>

          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              void register(event.currentTarget);
            }}
          >
            <div className="language-select-card">
              <div className="language-select-icon"><Globe2 size={19} /></div>
              <div className="grow">
                <strong>{tr('Language')}</strong>
                <span>{tr('Choose the language OjaFlow should use across the app.')}</span>
              </div>
              <select
                aria-label={tr('Language')}
                value={preferredLanguage}
                onChange={event => setPreferredLanguage(event.target.value as LanguagePreference)}
              >
                {languageOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="two-col">
              <label>{tr('First name')}<input name="firstName" required /></label>
              <label>{tr('Surname')}<input name="lastName" required /></label>
            </div>

            <label>{tr('Other name')} <span className="optional">{tr('Optional')}</span><input name="otherName" /></label>

            <label>
              {tr('Phone number')}
              <div className="phone-field">
                <span>+234</span>
                <input name="phone" inputMode="tel" placeholder="801 234 5678" required />
              </div>
            </label>

            <div className="two-col">
              <label>{tr('Password')}<input name="password" type="password" minLength={8} required /></label>
              <label>{tr('Confirm password')}<input name="confirm" type="password" minLength={8} required /></label>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button disabled={busy} className="primary-btn full">
              {busy ? tr('Creating account…') : tr('Create account')} <ArrowRight size={18} />
            </button>
          </form>
        </>
      ) : (
        <>
          <button
            className="back-btn auth-back"
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            <ArrowLeft size={17} /> {tr('Back to login')}
          </button>

          <span className="eyebrow">{tr('ACCOUNT RECOVERY')}</span>
          <h2>{tr('Forgot your password?')}</h2>

          <div className="recovery-info-card">
            <div className="round-icon"><KeyRound /></div>
            <p>{tr('Self-service password recovery is temporarily unavailable because OjaFlow does not yet have a verified free recovery channel.')}</p>
            <p className="muted">
              {tr('If you are still signed in on another device, open Settings → Security & Login → Change Password.')}
            </p>
          </div>
        </>
      )}
    </AuthLayout>
  );
}

function AuthLayout({
  language,
  eyebrow,
  heading,
  body,
  children
}: {
  language: LanguagePreference;
  eyebrow: string;
  heading: React.ReactNode;
  body: string;
  children: React.ReactNode;
}) {
  const tr = (key: string) => t(language, key);

  return (
    <div className="auth-layout">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span className="brand-mark large">O</span>
          <div>
            <b>OjaFlow</b>
            <small>{tr('Business command centre')}</small>
          </div>
        </div>

        <div className="auth-brand-copy">
          <span className="eyebrow light">{eyebrow}</span>
          <h1>{heading}</h1>
          <p>{body}</p>

          <div className="auth-benefits">
            <span><ShieldCheck size={18} /> {tr('Private account controls')}</span>
            <span><Sparkles size={18} /> {tr('OjaChat intelligent assistant')}</span>
          </div>
        </div>

        <small className="auth-footnote">{tr('Nigeria-first. Trader-focused. Built to scale.')}</small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card wide">{children}</div>
      </section>
    </div>
  );
}
