import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

function isStandalonePwaEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneDisplay =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
    window.matchMedia?.('(display-mode: minimal-ui)')?.matches;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );
  return Boolean(standaloneDisplay || iosStandalone);
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'ojaflow:pwa-install-dismissed';

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isCriOS = /CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isWebkit && !isCriOS;
}

export default function PwaInstallBanner() {
  const { tr } = useI18n();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === 'true'
  );
  const [isStandalone, setIsStandalone] = useState(() =>
    isStandalonePwaEnvironment()
  );

  useEffect(() => {
    if (isStandalonePwaEnvironment()) {
      setIsStandalone(true);
      return;
    }

    if (isIosSafari()) {
      setShowIosGuide(true);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isStandalone || dismissed || (!deferredPrompt && !showIosGuide)) {
    return null;
  }

  async function triggerInstall() {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch {
      /* ignore */
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  }

  return (
    <div className="pwa-install-banner" role="region" aria-label="Install OjaFlow App">
      <div className="pwa-install-icon">
        <Smartphone size={20} />
      </div>

      <div className="pwa-install-copy">
        <strong>{tr('Install OjaFlow on your phone')}</strong>
        <span>
          {deferredPrompt
            ? tr(
                'Open OjaFlow in 1 tap from your home screen — works fast even with weak market network.'
              )
            : tr(
                'On iPhone: tap the Share button below and choose “Add to Home Screen” for full offline access.'
              )}
        </span>
      </div>

      <div className="pwa-install-actions">
        {deferredPrompt && (
          <button
            type="button"
            className="pwa-install-cta"
            onClick={() => void triggerInstall()}
          >
            <Download size={15} />
            <span>{tr('Install App')}</span>
          </button>
        )}

        <button
          type="button"
          className="pwa-install-dismiss"
          onClick={dismiss}
          aria-label={tr('Dismiss install prompt')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

