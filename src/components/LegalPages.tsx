import { useEffect } from 'react';
import { ArrowLeft, FileText, HelpCircle, Shield } from 'lucide-react';

type PageType = 'terms' | 'privacy' | 'faq';

const pageTitles: Record<PageType, string> = {
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
  faq: 'Help and Frequently Asked Questions'
};

export default function LegalPages({
  type,
  onClose
}: {
  type: PageType;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const Icon = type === 'terms' ? FileText : type === 'privacy' ? Shield : HelpCircle;

  return (
    <div
      className="legal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="legal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-dialog-title"
      >
        <header className="legal-dialog-header">
          <div className="legal-dialog-heading">
            <Icon size={23} aria-hidden="true" />
            <h2 id="legal-dialog-title">{pageTitles[type]}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <ArrowLeft size={22} />
          </button>
        </header>

        <div className="legal-dialog-content">
          {type === 'terms' && <TermsContent />}
          {type === 'privacy' && <PrivacyContent />}
          {type === 'faq' && <FaqContent />}
        </div>
      </section>
    </div>
  );
}

function TermsContent() {
  return (
    <article className="legal-copy">
      <p><strong>Last updated:</strong> 2 November 2026</p>
      <p>
        These terms explain how you may use OjaFlow. By creating an account or
        continuing to use the service, you agree to them. If you do not agree,
        do not use OjaFlow.
      </p>

      <h3>1. Who may use OjaFlow</h3>
      <p>
        You must be at least 18 years old and able to enter into a legal
        agreement to create an account. You are responsible for providing
        accurate account information and keeping it up to date.
      </p>

      <h3>2. Your account</h3>
      <p>
        Keep your password and verification codes private. You are responsible
        for activity carried out through your account. Contact support promptly
        if you believe someone else has accessed it. OjaFlow will never ask you
        to share your password in a support ticket.
      </p>

      <h3>3. Your business records</h3>
      <p>
        You keep ownership of the information and records you enter. You are
        responsible for checking that your entries are accurate and for keeping
        copies of important records. OjaFlow provides tools to organise and
        summarise information; it does not replace your own review.
      </p>

      <h3>4. Appropriate use</h3>
      <p>
        Do not use OjaFlow to break the law, harm another person, interfere
        with the service, access another person&apos;s account, or upload
        harmful software or content. Do not attempt to bypass account or
        security controls.
      </p>

      <h3>5. Business guidance</h3>
      <p>
        OjaChat and other summaries are for general information. They are not
        professional legal, tax, accounting, investment or financial advice.
        Check important decisions with a qualified professional.
      </p>

      <h3>6. Service availability</h3>
      <p>
        Some features require an internet connection and services provided by
        other companies. We work to keep OjaFlow available, but cannot promise
        uninterrupted access. Check the sync status and keep your own copies
        of important records.
      </p>

      <h3>7. Changes and account closure</h3>
      <p>
        We may update OjaFlow or these terms as the service changes. We will
        publish the latest terms in the app. You may stop using OjaFlow and
        request account deletion from Settings. Deletion is permanent and may
        remove your business records.
      </p>

      <h3>8. Applicable law</h3>
      <p>
        These terms are subject to applicable Nigerian law and do not limit
        rights that cannot be excluded by law.
      </p>

      <p>
        For questions about these terms, open Help &amp; Support in Settings.
      </p>
    </article>
  );
}

function PrivacyContent() {
  return (
    <article className="legal-copy">
      <p><strong>Last updated:</strong> 2 November 2026</p>
      <p>
        This policy describes what information OjaFlow uses, why it is needed,
        and the choices available to you. OjaFlow is intended for business
        owners and users aged 18 or older.
      </p>

      <h3>1. Information you provide</h3>
      <p>
        This may include your name, phone number, password, language choice,
        business profile, sales, expenses, stock, customer and credit records,
        invoices, messages to OjaChat, and support requests.
      </p>

      <h3>2. Information stored on your device</h3>
      <p>
        OjaFlow uses essential browser storage to remember your session,
        preferences, and business records for the app. Records may remain on
        your device while you are offline. Anyone with access to an unlocked
        device or browser profile may be able to access information stored
        there.
      </p>

      <h3>3. How information is used</h3>
      <p>
        We use information to provide account access, display and organise your
        records, keep records in sync when you are online, prepare summaries,
        respond to support requests, protect the service, and meet legal
        obligations.
      </p>

      <h3>4. OjaChat and service providers</h3>
      <p>
        If you use OjaChat, your question and relevant business details may be
        sent to the service provider that generates its response. Information
        may also be handled by companies that host OjaFlow, store data, or
        provide essential service features. These providers process information
        to support the service and under their applicable terms.
      </p>

      <h3>5. Support requests</h3>
      <p>
        A support request is linked to your account and saved with its subject,
        category, message, status, and submission time so it can be reviewed.
        Do not include your password, verification code, or unnecessary
        sensitive information.
      </p>

      <h3>6. Cookies and essential browser storage</h3>
      <p>
        OjaFlow uses essential browser storage for sign-in, security, and
        preferences. The sign-up screen asks you to acknowledge this notice
        before creating an account. This storage is needed for the service to
        work; it is not an advertising preference.
      </p>

      <h3>7. Keeping and protecting information</h3>
      <p>
        We keep information while it is needed to provide the service, support
        your account, resolve issues, and meet legal obligations. We use
        safeguards intended to protect it, but no online service or device can
        be guaranteed completely secure.
      </p>

      <h3>8. Your choices</h3>
      <p>
        You can review or export business records from Settings and request
        account deletion there. Deleting your account may permanently remove
        associated records. You may also contact support to ask about your
        personal information or privacy rights.
      </p>

      <h3>9. Updates and contact</h3>
      <p>
        We may update this policy when the service or applicable requirements
        change. The latest version will be available here. For a privacy
        question or request, use Help &amp; Support in Settings.
      </p>
    </article>
  );
}

const faqs = [
  {
    question: 'How do I create an account?',
    answer: 'Choose Create account, enter your details and phone number, and set a password of at least eight characters. Accept the essential browser-storage notice, request a verification code, then enter the code to finish registration.'
  },
  {
    question: 'I did not receive a verification code. What should I do?',
    answer: 'Check that your phone number is correct and can receive messages, then try requesting a code again. If it still does not arrive, contact OjaFlow support. Never share a verification code with anyone.'
  },
  {
    question: 'How do I sign in?',
    answer: 'Use the phone number registered to your account and your password. Check the country code and number if sign-in does not work. Do not send your password in a support request.'
  },
  {
    question: 'What if I forget my password?',
    answer: 'If you are signed in on another device, open Settings, choose Security & Login, and change your password. If you cannot access your account, use the support contact provided by the OjaFlow service operator.'
  },
  {
    question: 'How do I record a sale?',
    answer: 'Open Sales and choose the option to add a sale. Enter the item, quantity, amount and any other requested details, then review the information before saving.'
  },
  {
    question: 'Will recording a sale change my stock?',
    answer: 'When a sale matches an item in your inventory by name, OjaFlow reduces that item’s recorded stock by the sale quantity. Check the item name and stock level if the result does not look right.'
  },
  {
    question: 'How do I record an expense?',
    answer: 'Open the sales and records area, choose Add expense, and enter the amount, date and description. Your summaries use the information you enter, so check it for accuracy.'
  },
  {
    question: 'How do I manage stock?',
    answer: 'Open Inventory to add products and review their recorded quantities. Update entries when stock changes, and check product names and quantities carefully.'
  },
  {
    question: 'How do customer balances and debts work?',
    answer: 'Record the customer and the amount owed in the debts area. When a payment is received, update the amount paid so the remaining balance reflects your records.'
  },
  {
    question: 'Can I create invoices?',
    answer: 'Yes. Use the invoice option in the sales area to enter the requested customer and item details. Review the invoice before sharing or relying on it.'
  },
  {
    question: 'Can I use OjaFlow without an internet connection?',
    answer: 'Some records can be entered while offline and remain on the device. They can be sent to your account when the device reconnects. Keep the device safe, and check the sync status before relying on another device to show recent changes.'
  },
  {
    question: 'Why are my records different on another device?',
    answer: 'Confirm both devices are online and signed in to the same account. Open Settings, check Backup & Sync, and wait for the latest changes to finish syncing. Do not clear browser data while unsynced records remain on the device.'
  },
  {
    question: 'How can I tell whether my records are up to date?',
    answer: 'Open Settings and select Backup & Sync. It shows whether records are syncing, up to date, offline, or need attention. You can also choose Sync now when you have an internet connection.'
  },
  {
    question: 'How do I download a copy of my records?',
    answer: 'Open Settings, choose Export My Data, then select the full backup or spreadsheet downloads. Store exported files somewhere private and secure; they may contain sensitive business information.'
  },
  {
    question: 'Why do totals or summaries look incorrect?',
    answer: 'Summaries are based on the records entered in OjaFlow and the dates selected. Check for missing, duplicated, or incorrectly entered sales, expenses, stock changes, and payments before using totals for business decisions.'
  },
  {
    question: 'Can I change the language?',
    answer: 'Choose Language under Settings to update the language used across supported parts of the app. Some service notices may still appear in English.'
  },
  {
    question: 'How does OjaFlow protect my information?',
    answer: 'Keep your password private, sign out on shared devices, and protect the device where your records are stored. OjaFlow uses account and service safeguards, but you should also keep secure copies of important records.'
  },
  {
    question: 'What information should I send in a support request?',
    answer: 'Describe what you were trying to do, what happened, and the general time it occurred. Include the ticket reference if you have one. Do not include your password, verification code, or full payment-card details.'
  },
  {
    question: 'Where does my support request go?',
    answer: 'The request is saved in OjaFlow’s support database and linked to your account. After submission, keep the ticket reference shown on screen. The current app does not show staff replies or ticket progress.'
  },
  {
    question: 'How do I delete my account?',
    answer: 'Open Settings and choose Delete Account. Read the confirmation carefully: deletion is permanent and may remove your business records. Export anything you need before confirming.'
  },
  {
    question: 'What should I know before using OjaChat?',
    answer: 'OjaChat can use your question and relevant business details to prepare a response. Avoid entering passwords, verification codes, or private information that is not needed. Treat its suggestions as general information and verify important decisions.'
  }
];

function FaqContent() {
  return (
    <div className="faq-list legal-faq-list">
      <p className="legal-faq-intro">
        Browse common questions about accounts, records, syncing, privacy and support.
        If you still need help, open Help &amp; Support in Settings.
      </p>
      {faqs.map(({ question, answer }) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}
