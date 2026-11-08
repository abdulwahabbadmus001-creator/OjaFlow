import { useEffect, useState } from 'react';
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

import { api, type RemoteStoreSnapshot } from '../lib/api';
import { languageOptions, t } from '../lib/language';
import { normalizeNigerianPhone } from '../lib/phone';
import {
  LOCALIZED_ANSWER_PLACEHOLDERS,
  LOCALIZED_CUSTOM_QUESTION_PLACEHOLDERS,
  LOCALIZED_TRADER_SECURITY_QUESTIONS,
  TRADER_SECURITY_QUESTIONS
} from '../lib/securityQuestions';
import type {
  BusinessProfile,
  LanguagePreference,
  UserProfile
} from '../types';

import BrandLogo from '../components/BrandLogo';

export {
  LOCALIZED_ANSWER_PLACEHOLDERS,
  LOCALIZED_CUSTOM_QUESTION_PLACEHOLDERS,
  LOCALIZED_TRADER_SECURITY_QUESTIONS,
  TRADER_SECURITY_QUESTIONS
};

type AuthMode = 'login' | 'register' | 'forgot';
type RecoveryStep = 'identify' | 'answer' | 'reset';

const PIN_REGEX = /^\d{4}$/;

const CUSTOM_QUESTION_VALUE = '__custom__';

function enforceDigitsOnly(event: React.FormEvent<HTMLInputElement>) {
  const cleaned = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
  if (event.currentTarget.value !== cleaned) {
    event.currentTarget.value = cleaned;
  }
}

export default function AuthPage({
  onAuthenticated,
  cookieConsentAccepted
}: {
  onAuthenticated: (
    profile: UserProfile,
    business?: BusinessProfile | null,
    remoteStore?: RemoteStoreSnapshot,
    tokens?: { accessToken?: string; csrfToken?: string }
  ) => void;
  cookieConsentAccepted: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [selectedQuestionChoice, setSelectedQuestionChoice] = useState<string>(
    '0'
  );
  const [customSecurityQuestion, setCustomSecurityQuestion] = useState('');

  // Forgot PIN recovery flow state
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('identify');
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryQuestionText, setRecoveryQuestionText] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');

  const [preferredLanguage, setPreferredLanguage] =
    useState<LanguagePreference>('en');

  const localizedQuestions =
    LOCALIZED_TRADER_SECURITY_QUESTIONS[preferredLanguage] ||
    LOCALIZED_TRADER_SECURITY_QUESTIONS.en;

  const tr = (
    key: string,
    vars?: Record<string, string | number>
  ) => t(preferredLanguage, key, vars);

  function resetRecoveryState() {
    setRecoveryStep('identify');
    setRecoveryIdentifier('');
    setRecoveryQuestionText('');
    setRecoveryAnswer('');
    setRecoveryToken('');
    setError('');
  }

  async function login(form: HTMLFormElement) {
    const fd = new FormData(form);
    const loginIdentifier = String(fd.get('phone') || '').trim();
    const pin = String(fd.get('pin') || '').trim();

    if (!PIN_REGEX.test(pin)) {
      setError(tr('Enter your 4-digit PIN.'));
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await api.loginPassword(
        /^OJA/i.test(loginIdentifier)
          ? loginIdentifier
          : normalizeNigerianPhone(loginIdentifier),
        pin
      );

      onAuthenticated(result.profile, result.business, result.store, {
        accessToken: result.accessToken,
        csrfToken: result.csrfToken
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Could not sign in.')
      );
    } finally {
      setBusy(false);
    }
  }

  async function register(form: HTMLFormElement) {
    if (!cookieConsentAccepted) {
      setError(tr('Accept the essential cookies and browser storage notice before creating an account.'));
      return;
    }

    const fd = new FormData(form);

    const pin = String(fd.get('pin') || '').trim();
    const confirm = String(fd.get('confirm') || '').trim();
    const finalQuestion = (
      selectedQuestionChoice === CUSTOM_QUESTION_VALUE
        ? customSecurityQuestion
        : localizedQuestions[Number(selectedQuestionChoice)] ||
          localizedQuestions[0]
    ).trim();
    const securityAnswer = String(fd.get('securityAnswer') || '').trim();

    if (!PIN_REGEX.test(pin)) {
      setError(
        tr('PIN must be exactly 4 digits.')
      );
      return;
    }

    if (pin !== confirm) {
      setError(tr('PINs do not match.'));
      return;
    }

    if (finalQuestion.length < 5) {
      setError(tr('Choose or write a security question for PIN recovery.'));
      return;
    }

    if (securityAnswer.length < 2) {
      setError(tr('Enter an answer of at least 2 characters for your security question.'));
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
        pin,
        securityQuestion: finalQuestion,
        securityAnswer,
        preferredLanguage
      });
      onAuthenticated(result.profile, result.business, result.store, {
        accessToken: result.accessToken,
        csrfToken: result.csrfToken
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Could not create your account.')
      );
    } finally {
      setBusy(false);
    }
  }

  async function lookupRecoveryQuestion(form: HTMLFormElement) {
    const fd = new FormData(form);
    const rawId = String(fd.get('identifier') || '').trim();
    if (!rawId) {
      setError(tr('Enter your phone number or OjaTag.'));
      return;
    }

    const normalizedId = /^OJA/i.test(rawId)
      ? rawId
      : normalizeNigerianPhone(rawId);

    setBusy(true);
    setError('');

    try {
      const result = await api.recoveryQuestion(
        normalizedId,
        preferredLanguage
      );
      setRecoveryIdentifier(normalizedId);
      setRecoveryQuestionText(result.securityQuestion);
      if (result.preferredLanguage) {
        setPreferredLanguage(result.preferredLanguage);
      }
      setRecoveryStep('answer');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Could not look up recovery question.')
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyRecoveryAnswer(form: HTMLFormElement) {
    const fd = new FormData(form);
    const answer = String(fd.get('securityAnswer') || '').trim();
    if (answer.length < 2) {
      setError(tr('Enter your security answer.'));
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await api.recoveryVerifyAnswer(recoveryIdentifier, answer);
      setRecoveryAnswer(answer);
      setRecoveryToken(result.recoveryToken);
      setRecoveryStep('reset');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Incorrect security answer or account details.')
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPin(form: HTMLFormElement) {
    const fd = new FormData(form);
    const newPin = String(fd.get('newPin') || '').trim();
    const confirmPin = String(fd.get('confirmPin') || '').trim();

    if (!PIN_REGEX.test(newPin)) {
      setError(tr('New PIN must be exactly 4 digits.'));
      return;
    }

    if (newPin !== confirmPin) {
      setError(tr('PINs do not match.'));
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await api.recoveryResetPin({
        recoveryToken,
        identifier: recoveryIdentifier,
        securityAnswer: recoveryAnswer,
        newPin
      });
      resetRecoveryState();
      onAuthenticated(result.profile, result.business, result.store, {
        accessToken: result.accessToken,
        csrfToken: result.csrfToken
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Could not reset your 4-digit PIN.')
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      language={preferredLanguage}
      eyebrow={tr('BUILT FOR EVERYDAY TRADE')}
      heading={
        <>
          {tr('Know your numbers.')}
          <br />
          {tr('Run with confidence.')}
        </>
      }
      body={tr(
        'Sales, stock, expenses, customers, debts and business guidance in one calm workspace.'
      )}
    >
      <div className="auth-language-inline">
        <Globe2 size={16} />

        <select
          aria-label={tr('Language')}
          value={preferredLanguage}
          onChange={event =>
            setPreferredLanguage(
              event.target.value as LanguagePreference
            )
          }
        >
          {languageOptions.map(option => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="auth-tabs">
        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => {
            setMode('login');
            setError('');
          }}
        >
          {tr('Log in')}
        </button>

        <button
          type="button"
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
          <span className="eyebrow">
            {tr('WELCOME BACK')}
          </span>

          <h2>{tr('Continue to your business')}</h2>

          <p className="muted">
            {tr(
              'Use your registered phone number or OjaTag and 4-digit PIN.'
            )}
          </p>

          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              void login(event.currentTarget);
            }}
          >
            <label>
              {tr('Phone number or OjaTag')}
              <input
                name="phone"
                autoComplete="username"
                placeholder="801 234 5678 or OJA-XXXX-XXXX"
                required
              />
            </label>

            <label>
              {tr('4-digit PIN')}

              <div className="password-field">
                <input
                  name="pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="\d{4}"
                  minLength={4}
                  maxLength={4}
                  autoComplete="current-password"
                  placeholder="••••"
                  onInput={enforceDigitsOnly}
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPin(value => !value)
                  }
                  aria-label={
                    showPin
                      ? tr('Hide PIN')
                      : tr('Show PIN')
                  }
                >
                  {showPin ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            <button
              type="button"
              className="forgot-link"
              onClick={() => {
                resetRecoveryState();
                setMode('forgot');
              }}
            >
              {tr('Forgot PIN?')}
            </button>

            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            <button
              disabled={busy}
              className="primary-btn full"
            >
              {busy
                ? tr('Signing in…')
                : tr('Log in')}

              <ArrowRight size={18} />
            </button>
          </form>
        </>
      ) : mode === 'register' ? (
        <>
          <span className="eyebrow">
            {tr('NEW TO OJAFLOW?')}
          </span>

          <h2>{tr('Create your trader account')}</h2>

          <p className="muted">
            {tr(
              'No email required. Your phone number and unique OjaTag let you log in on any device with your 4-digit PIN.'
            )}
          </p>

          <div className="auth-security-note">
            <ShieldCheck size={18} />

            <span>
              {tr(
                'Your account will be created immediately without SMS verification.'
              )}
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
              <div className="language-select-icon">
                <Globe2 size={19} />
              </div>

              <div className="grow">
                <strong>{tr('Language')}</strong>

                <span>
                  {tr(
                    'Choose the language OjaFlow should use across the app.'
                  )}
                </span>
              </div>

              <select
                aria-label={tr('Language')}
                value={preferredLanguage}
                onChange={event =>
                  setPreferredLanguage(event.target.value as LanguagePreference)
                }
              >
                {languageOptions.map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="two-col">
              <label>
                {tr('First name')}
                <input name="firstName" required />
              </label>

              <label>
                {tr('Surname')}
                <input name="lastName" required />
              </label>
            </div>

            <label>
              {tr('Other name')}{' '}
              <span className="optional">
                {tr('Optional')}
              </span>

              <input name="otherName" />
            </label>

            <label>
              {tr('Phone number')}

              <div className="phone-field">
                <span>+234</span>

                <input
                  name="phone"
                  inputMode="tel"
                  placeholder="801 234 5678"
                  required
                />
              </div>
            </label>

            <div className="two-col">
              <label>
                {tr('4-digit PIN')}

                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  minLength={4}
                  maxLength={4}
                  autoComplete="new-password"
                  placeholder="••••"
                  onInput={enforceDigitsOnly}
                  required
                />
              </label>

              <label>
                {tr('Confirm 4-digit PIN')}

                <input
                  name="confirm"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  minLength={4}
                  maxLength={4}
                  autoComplete="new-password"
                  placeholder="••••"
                  onInput={enforceDigitsOnly}
                  required
                />
              </label>
            </div>

            <label>
              {tr('Security question (in your preferred language or dialect)')}

              <select
                name="securityQuestionSelect"
                value={selectedQuestionChoice}
                onChange={event =>
                  setSelectedQuestionChoice(event.target.value)
                }
              >
                {localizedQuestions.map((question, idx) => (
                  <option key={idx} value={String(idx)}>
                    {question}
                  </option>
                ))}
                <option value={CUSTOM_QUESTION_VALUE}>
                  {tr('Write my own personal trade question…')}
                </option>
              </select>
            </label>

            {selectedQuestionChoice === CUSTOM_QUESTION_VALUE && (
              <label>
                {tr('Your custom security question (any language or dialect)')}

                <input
                  name="customSecurityQuestion"
                  value={customSecurityQuestion}
                  onChange={event =>
                    setCustomSecurityQuestion(event.target.value)
                  }
                  placeholder={
                    LOCALIZED_CUSTOM_QUESTION_PLACEHOLDERS[
                      preferredLanguage
                    ]
                  }
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
                placeholder={
                  LOCALIZED_ANSWER_PLACEHOLDERS[preferredLanguage]
                }
                minLength={2}
                maxLength={160}
                required
              />
            </label>

            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            {!cookieConsentAccepted && (
              <p className="auth-consent-note">
                {tr('Accept the essential cookies and browser storage notice below before creating your account.')}
              </p>
            )}

            <button
              disabled={busy || !cookieConsentAccepted}
              className="primary-btn full"
            >
              {busy
                ? tr('Please wait…')
                : tr('Create account')}

              <ArrowRight size={18} />
            </button>
          </form>
        </>
      ) : (
        <>
          <button
            type="button"
            className="back-btn auth-back"
            onClick={() => {
              resetRecoveryState();
              setMode('login');
            }}
          >
            <ArrowLeft size={17} />
            {tr('Back to login')}
          </button>

          <span className="eyebrow">
            {tr('ACCOUNT RECOVERY')}
          </span>

          <h2>{tr('Recover your 4-digit PIN')}</h2>

          {recoveryStep === 'identify' ? (
            <>
              <p className="muted">
                {tr(
                  'Enter your registered phone number or OjaTag to view your personal trader security question.'
                )}
              </p>

              <form
                className="form-stack"
                onSubmit={event => {
                  event.preventDefault();
                  void lookupRecoveryQuestion(event.currentTarget);
                }}
              >
                <label>
                  {tr('Phone number or OjaTag')}
                  <input
                    name="identifier"
                    autoComplete="username"
                    placeholder="801 234 5678 or OJA-XXXX-XXXX"
                    required
                  />
                </label>

                {error && <div className="form-error">{error}</div>}

                <button disabled={busy} className="primary-btn full">
                  {busy ? tr('Checking…') : tr('Continue')}
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          ) : recoveryStep === 'answer' ? (
            <>
              <p className="muted">
                {tr(
                  'Answer the personal security question you set when creating your OjaFlow account.'
                )}
              </p>

              <div className="auth-security-note">
                <KeyRound size={18} />
                <span>
                  <strong>{recoveryQuestionText}</strong>
                </span>
              </div>

              <form
                className="form-stack"
                onSubmit={event => {
                  event.preventDefault();
                  void verifyRecoveryAnswer(event.currentTarget);
                }}
              >
                <label>
                  {tr('Your security answer')}
                  <input
                    name="securityAnswer"
                    type="text"
                    autoComplete="off"
                    placeholder={tr('Type your answer')}
                    minLength={2}
                    maxLength={160}
                    required
                  />
                </label>

                {error && <div className="form-error">{error}</div>}

                <button disabled={busy} className="primary-btn full">
                  {busy ? tr('Verifying…') : tr('Verify answer')}
                  <ArrowRight size={18} />
                </button>

                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => {
                    setRecoveryStep('identify');
                    setError('');
                  }}
                >
                  {tr('Use a different phone number or OjaTag')}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="muted">
                {tr(
                  'Security answer verified! Enter your new 4-digit PIN below to sign right back into your shop.'
                )}
              </p>

              <form
                className="form-stack"
                onSubmit={event => {
                  event.preventDefault();
                  void submitNewPin(event.currentTarget);
                }}
              >
                <div className="two-col">
                  <label>
                    {tr('New 4-digit PIN')}
                    <input
                      name="newPin"
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="\d{4}"
                      minLength={4}
                      maxLength={4}
                      autoComplete="new-password"
                      placeholder="••••"
                      onInput={enforceDigitsOnly}
                      required
                    />
                  </label>

                  <label>
                    {tr('Confirm new PIN')}
                    <input
                      name="confirmPin"
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="\d{4}"
                      minLength={4}
                      maxLength={4}
                      autoComplete="new-password"
                      placeholder="••••"
                      onInput={enforceDigitsOnly}
                      required
                    />
                  </label>
                </div>

                {error && <div className="form-error">{error}</div>}

                <button disabled={busy} className="primary-btn full">
                  {busy ? tr('Saving PIN…') : tr('Save new 4-digit PIN')}
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}
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
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setBgReady(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  const marketImages = [
    '/auth-market/market-1.webp',
    '/auth-market/market-2.webp',
    '/auth-market/market-3.webp',
    '/auth-market/market-4.webp'
  ];

  return (
    <main className="premium-auth">
      {bgReady && (
        <div
          className="auth-market-background"
          aria-hidden="true"
        >
          <div className="auth-market-track">
            {[...marketImages, ...marketImages].map(
              (image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="auth-market-photo"
                  style={{
                    backgroundImage: `url("${image}")`
                  }}
                />
              )
            )}
          </div>
        </div>
      )}

      <div
        className="auth-market-mask"
        aria-hidden="true"
      />

      <header className="auth-premium-top">
        <BrandLogo
          subtitle={tr('Business command centre')}
        />
      </header>

      <div className="auth-premium-content">
        <section className="auth-premium-story">
          <span className="eyebrow light">
            {eyebrow}
          </span>

          <h1>{heading}</h1>

          <p>{body}</p>

          <div className="auth-benefits">
            <span>
              <ShieldCheck size={18} />
              {tr('Private account controls')}
            </span>

            <span>
              <Sparkles size={18} />
              {tr('OjaChat intelligent assistant')}
            </span>
          </div>

          <small className="auth-footnote">
            {tr(
              'Nigeria-first. Trader-focused. Built to scale.'
            )}
          </small>
        </section>

        <section className="auth-premium-form">
          <div className="auth-card wide">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
