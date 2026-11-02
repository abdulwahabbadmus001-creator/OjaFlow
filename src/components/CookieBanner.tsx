import { ShieldCheck } from 'lucide-react';

export const COOKIE_CONSENT_KEY = 'ojaflow_cookie_consent';

export default function CookieBanner({
  onAccept,
  onOpenPrivacy
}: {
  onAccept: () => void;
  onOpenPrivacy: () => void;
}) {
  return (
    <aside className="cookie-banner" aria-label="Cookie and browser storage notice">
      <div className="cookie-banner-content">
        <ShieldCheck className="cookie-banner-icon" size={22} aria-hidden="true" />
        <div className="cookie-banner-copy">
          <strong>Essential cookies and browser storage</strong>
          <p>
            OjaFlow uses essential browser storage for sign-in, security and your preferences.
            Accept this notice before creating an account. Read our{' '}
            <button type="button" onClick={onOpenPrivacy}>Privacy Policy</button>.
          </p>
        </div>
        <button type="button" className="primary-btn cookie-accept" onClick={onAccept}>
          Accept and continue
        </button>
      </div>
    </aside>
  );
}