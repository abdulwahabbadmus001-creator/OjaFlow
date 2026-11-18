import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Banknote,
  BarChart3,
  BookOpenCheck,
  Boxes,
  Check,
  CircleHelp,
  ClipboardList,
  Globe2,
  Menu,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
  X
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import './LandingPage.css';

type PreviewTab = 'Overview' | 'Inventory' | 'Sales' | 'Expenses' | 'Debts';

const previewTabs: { label: PreviewTab; icon: typeof BarChart3 }[] = [
  { label: 'Overview', icon: BarChart3 },
  { label: 'Inventory', icon: Package },
  { label: 'Sales', icon: ReceiptText },
  { label: 'Expenses', icon: Wallet },
  { label: 'Debts', icon: Banknote }
];

const previewItems = [
  { name: 'Golden Penny Semovita', category: 'Groceries', stock: '24 bags', price: '₦8,500' },
  { name: 'Palm oil · 5 litres', category: 'Food & drink', stock: '8 bottles', price: '₦12,000' },
  { name: 'Classic Ankara', category: 'Fashion', stock: '12 yards', price: '₦4,500' }
];

const faqs = [
  {
    question: 'What is OjaFlow?',
    answer: 'OjaFlow is a business-records app for traders and small businesses. It brings product and stock records, sales, expenses, customers, debts, invoices and business guidance together in one workspace.'
  },
  {
    question: 'Who can use OjaFlow?',
    answer: 'OjaFlow is designed for market traders, shop owners, merchants and small business operators who want a more organised way to keep everyday business records.'
  },
  {
    question: 'How do I create an account?',
    answer: 'Choose Create account, enter your name and Nigerian phone number, choose a supported language, set a four-digit PIN and a recovery question, then accept the essential browser-storage notice. The app currently creates accounts without SMS verification. After registration, complete your business profile.'
  },
  {
    question: 'How do I sign in or recover my PIN?',
    answer: 'Sign in with your registered phone number or OjaTag and your four-digit PIN. If you forget your PIN, choose “Forgot PIN?” and follow the account recovery question steps.'
  },
  {
    question: 'Can I manage products, sales and expenses?',
    answer: 'Yes. Add products and review recorded quantities in Inventory. Record sales and expenses in the sales and records area. OjaFlow updates a matching inventory item’s recorded stock when you save a sale, so review the item name and quantity you enter.'
  },
  {
    question: 'Can I keep track of customer debts and invoices?',
    answer: 'Yes. You can record customer debts and update amounts paid, keep customer records, and create invoices from the sales area.'
  },
  {
    question: 'What is OjaTag?',
    answer: 'OjaTag is the unique trader identifier shown in your account. You can use it, as well as your registered phone number, to sign in.'
  },
  {
    question: 'What is OjaChat?',
    answer: 'OjaChat is an in-app assistant that can respond to questions using relevant business records or general business topics. Its suggestions are general information, not professional financial, tax or legal advice.'
  },
  {
    question: 'Does OjaFlow work offline?',
    answer: 'Some records can be entered while offline and remain on that device. They can sync when it reconnects. Offline changes are not immediately available on other devices; check the sync status before relying on records elsewhere.'
  },
  {
    question: 'How is my business information handled?',
    answer: 'OjaFlow uses browser storage for your session, preferences and records, and syncs records to your account when online. OjaChat questions and relevant business details may be sent to the service provider that generates its response. Read the Privacy Policy for more detail, and avoid using shared or unlocked devices for private records.'
  },
  {
    question: 'Can I manage more than one business?',
    answer: 'The current account setup is centered on one business profile. The app does not currently provide a multi-business or multi-store switcher.'
  }
];

function ProductPreview({ active }: { active: PreviewTab }) {
  return (
    <div className="landing-preview-window" aria-label={`${active} product preview`}>
      <div className="landing-preview-topbar">
        <div className="landing-preview-dots" aria-hidden="true"><i /><i /><i /></div>
        <span>OjaFlow workspace</span>
        <span className="landing-preview-status"><i /> Sample view</span>
      </div>
      <div className="landing-preview-body">
        <aside className="landing-preview-sidebar" aria-label="Sample navigation">
          <div className="landing-preview-brand"><span>OF</span><strong>OjaFlow</strong></div>
          {previewTabs.map(({ label, icon: Icon }) => (
            <div className={label === active ? 'landing-preview-nav active' : 'landing-preview-nav'} key={label}>
              <Icon size={15} aria-hidden="true" />{label}
            </div>
          ))}
          <div className="landing-preview-shop"><span>Sample shop</span><strong>Everyday Traders</strong></div>
        </aside>
        <div className="landing-preview-main">
          <div className="landing-preview-heading">
            <div><span className="landing-preview-kicker">SAMPLE BUSINESS · ILLUSTRATIVE DATA</span><h3>{active === 'Overview' ? 'Good morning' : active}</h3><p>A quick look at your business records.</p></div>
            <span className="landing-preview-date">Today · 18 Nov</span>
          </div>
          {active === 'Inventory' ? (
            <div className="landing-preview-table">
              <div className="landing-preview-row table-head"><span>Product</span><span>In stock</span><span>Price</span></div>
              {previewItems.map(item => <div className="landing-preview-row" key={item.name}><span><strong>{item.name}</strong><small>{item.category}</small></span><span>{item.stock}</span><span>{item.price}</span></div>)}
              <p className="landing-preview-note"><Package size={14} /> Product quantities and restock levels in one view.</p>
            </div>
          ) : active === 'Sales' || active === 'Expenses' ? (
            <div className="landing-preview-records">
              <div className="landing-preview-summary"><span>{active === 'Sales' ? 'Recorded sales' : 'Recorded expenses'}<strong>{active === 'Sales' ? '₦86,500' : '₦18,200'}</strong></span><span>Entries today<strong>{active === 'Sales' ? '8' : '3'}</strong></span></div>
              <div className="landing-preview-chart" aria-hidden="true">{[42, 65, 50, 76, 57, 91, 70, 84, 61, 96, 73, 88].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div>
              <div className="landing-preview-note"><ClipboardList size={14} /> Review the records you enter and keep a clearer picture.</div>
            </div>
          ) : active === 'Debts' ? (
            <div className="landing-preview-debts">
              <div className="landing-preview-summary"><span>Outstanding balance<strong>₦42,000</strong></span><span>Customer records<strong>6</strong></span></div>
              {['Amina Bello', 'Tunde Ade', 'Kemi Okafor'].map((name, i) => <div className="landing-preview-debt-row" key={name}><span className="landing-preview-avatar">{name.charAt(0)}</span><strong>{name}</strong><span>₦{[12000, 8500, 6500][i].toLocaleString()}</span></div>)}
            </div>
          ) : (
            <>
              <div className="landing-preview-stats">
                <div><span>Sales recorded</span><strong>₦86,500</strong><small><Check size={12} /> Entered today</small></div>
                <div><span>Products listed</span><strong>24</strong><small><Boxes size={12} /> In your inventory</small></div>
                <div><span>Customer balances</span><strong>₦42,000</strong><small><Users size={12} /> Across 6 records</small></div>
              </div>
              <div className="landing-preview-lower">
                <div className="landing-preview-chart-card"><strong>Sales overview</strong><span>Illustrative weekly view</span><div className="landing-preview-chart" aria-hidden="true">{[46, 60, 53, 78, 64, 88, 72, 94, 70, 85, 68, 96].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div>
                <div className="landing-preview-list-card"><strong>Stock to review</strong>{previewItems.slice(0, 2).map(item => <div key={item.name}><span>{item.name}</span><small>{item.stock} left</small></div>)}</div>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="landing-preview-disclaimer">Illustrative sample records — not a live account or actual business data.</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: typeof Package; title: string; description: string }) {
  return <article className="landing-feature-card"><span className="landing-feature-icon"><Icon size={21} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p></article>;
}

export default function LandingPage({
  onOpenLegal
}: {
  onOpenLegal: (page: 'privacy' | 'terms') => void;
}) {
  const [activePreview, setActivePreview] = useState<PreviewTab>('Overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.title = 'OjaFlow — Business records, all in one place';
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', 'Keep products, sales, expenses and customer records organised with OjaFlow, a business management app for Nigerian traders.');
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuToggle.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  function onPreviewKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % previewTabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + previewTabs.length) % previewTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = previewTabs.length - 1;
    else return;
    event.preventDefault();
    const next = previewTabs[nextIndex];
    setActivePreview(next.label);
    document.getElementById(`landing-tab-${next.label.toLowerCase()}`)?.focus();
  }

  const closeMenu = () => setMenuOpen(false);
  const sectionLink = (id: string, label: string) => <a href={`#${id}`} onClick={closeMenu}>{label}</a>;

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#landing-main">Skip to content</a>
      <header className="landing-header">
        <div className="landing-header-inner">
          <a className="landing-brand-link" href="/" aria-label="OjaFlow home"><BrandLogo /></a>
          <nav className="landing-desktop-nav" aria-label="Main navigation">
            {sectionLink('features', 'Features')}
            {sectionLink('how-it-works', 'How it works')}
            {sectionLink('faq', 'FAQs')}
          </nav>
          <div className="landing-header-actions">
            <a className="landing-signin" href="#/login">Sign in</a>
            <a className="landing-button landing-button-small" href="#/register">Create account <ArrowRight size={16} /></a>
          </div>
          <button ref={menuToggle} className="landing-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="landing-mobile-nav" onClick={() => setMenuOpen(open => !open)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <nav id="landing-mobile-nav" className={`landing-mobile-nav${menuOpen ? ' open' : ''}`} aria-label="Mobile navigation" hidden={!menuOpen}>
          {sectionLink('features', 'Features')}
          {sectionLink('how-it-works', 'How it works')}
          {sectionLink('faq', 'FAQs')}
          <a href="#/login" onClick={closeMenu}>Sign in</a>
          <a className="landing-mobile-cta" href="#/register" onClick={closeMenu}>Create account <ArrowRight size={16} /></a>
        </nav>
      </header>

      <main id="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <span className="landing-eyebrow"><span /> BUSINESS MANAGEMENT FOR NIGERIAN TRADERS</span>
              <h1>Your business.<br /><em>Your records.</em><br />One place.</h1>
              <p className="landing-hero-text">Manage your products, sales, expenses and customer records with a simpler way to stay on top of your business.</p>
              <div className="landing-hero-actions"><a className="landing-button" href="#/register">Get started <ArrowRight size={18} /></a><a className="landing-text-link" href="#product-preview">Explore OjaFlow <ArrowDown size={16} /></a></div>
              <div className="landing-hero-points"><span><Check size={15} /> Made for everyday trade</span><span><Check size={15} /> Start with your phone number</span></div>
            </div>
            <div className="landing-hero-art" aria-label="Illustrative OjaFlow product preview">
              <div className="landing-hero-note"><span className="landing-note-icon"><ShoppingBag size={17} /></span><span><strong>Made for your day-to-day</strong><small>Keep your business records together</small></span></div>
              <div className="landing-hero-preview"><ProductPreview active={activePreview} /></div>
              <div className="landing-deco-circle" aria-hidden="true" />
            </div>
          </div>
          <div className="landing-hero-bottom"><span>TOOLS FOR THE EVERYDAY WORK OF RUNNING A BUSINESS</span><span className="landing-hero-bottom-line" /></div>
        </section>

        <section id="product-preview" className="landing-showcase landing-section">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">A LOOK INSIDE</span>
            <h2>See your business<br /><em>more clearly.</em></h2>
            <p>Explore a sample of the records you can manage in OjaFlow. Previews use fictional examples and never connect to a real account.</p>
          </div>
          <div className="landing-showcase-content">
            <div className="landing-preview-tabs" role="tablist" aria-label="Explore sample product screens">
              {previewTabs.map(({ label, icon: Icon }, index) => <button key={label} id={`landing-tab-${label.toLowerCase()}`} type="button" role="tab" aria-selected={activePreview === label} aria-controls="landing-preview-panel" tabIndex={activePreview === label ? 0 : -1} className={activePreview === label ? 'active' : ''} onClick={() => setActivePreview(label)} onKeyDown={event => onPreviewKeyDown(event, index)}><Icon size={17} />{label}</button>)}
            </div>
            <div id="landing-preview-panel" role="tabpanel" aria-labelledby={`landing-tab-${activePreview.toLowerCase()}`}><ProductPreview active={activePreview} /></div>
          </div>
        </section>

        <section id="features" className="landing-features landing-section">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">PRACTICAL TOOLS, TOGETHER</span>
            <h2>The records that matter,<br /><em>within reach.</em></h2>
            <p>Useful tools for the everyday work of selling, keeping stock and looking after customers.</p>
          </div>
          <div className="landing-feature-grid">
            <FeatureCard icon={Package} title="Products & inventory" description="List products, record quantities and selling prices, and see items that need your attention." />
            <FeatureCard icon={ReceiptText} title="Sales records" description="Record sales and review your entries. A sale can update matching inventory quantities." />
            <FeatureCard icon={Wallet} title="Expenses" description="Keep expense entries alongside sales so you can review the figures you have recorded." />
            <FeatureCard icon={Users} title="Customers & debts" description="Keep customer details, record balances owed and update the amount paid." />
            <FeatureCard icon={BookOpenCheck} title="Invoices & records" description="Create invoices and keep business documents connected to your day-to-day records." />
            <FeatureCard icon={Sparkles} title="OjaChat assistance" description="Ask about relevant business records or general topics, and review its suggestions with care." />
            <FeatureCard icon={ShieldCheck} title="Your OjaTag" description="Find your unique trader identifier in your account and use it to sign in." />
            <FeatureCard icon={Globe2} title="Language & device access" description="Choose from supported language options. Some records can stay on your device while offline and sync after reconnecting." />
          </div>
        </section>

        <section id="how-it-works" className="landing-how landing-section">
          <div className="landing-how-intro">
            <span className="landing-eyebrow">A STRAIGHTFORWARD START</span>
            <h2>Set up once.<br /><em>Get on with trade.</em></h2>
            <p>Begin with the details OjaFlow needs, then add records as you go. You stay in control of what you enter.</p>
            <a className="landing-button" href="#/register">Create your account <ArrowRight size={18} /></a>
          </div>
          <ol className="landing-steps">
            <li><span className="landing-step-number">01</span><div><h3>Create an account</h3><p>Register with your name and Nigerian phone number, then set a four-digit PIN and recovery question.</p></div></li>
            <li><span className="landing-step-number">02</span><div><h3>Set up your business</h3><p>Add your business name, category, phone number and address to personalise your workspace.</p></div></li>
            <li><span className="landing-step-number">03</span><div><h3>Add products and records</h3><p>List what you sell, then record sales, expenses, customers and other business activity.</p></div></li>
            <li><span className="landing-step-number">04</span><div><h3>Review and keep things in sync</h3><p>Check your records and sync status. Some entries can wait on your device until you reconnect.</p></div></li>
          </ol>
        </section>

        <section className="landing-audience landing-section">
          <div className="landing-audience-visual"><span className="landing-audience-mark"><Boxes size={33} /></span><div className="landing-audience-card"><small>BUSINESS RECORDS, MADE MORE VISIBLE</small><strong>From the first entry<br />to the next decision.</strong><span>Keep what you know about your business close at hand.</span></div></div>
          <div className="landing-audience-copy"><span className="landing-eyebrow">BUILT AROUND REAL BUSINESS DAYS</span><h2>For traders who<br /><em>keep things moving.</em></h2><p>Whether you run a market stall, a retail shop or a growing small business, OjaFlow gives everyday records a more organised home.</p><ul><li><Check size={17} /> Find your product and stock records in one place</li><li><Check size={17} /> Review sales and expenses you have entered</li><li><Check size={17} /> Keep customer details and balances together</li></ul></div>
        </section>

        <section className="landing-vision">
          <div className="landing-vision-inner"><span className="landing-eyebrow">A FOUNDATION THAT CAN GROW</span><h2>More room for Nigerian businesses<br />to do their best work.</h2><p>OjaFlow is being built as a practical foundation for essential business tools—starting with clearer records for the work traders do every day.</p><a href="#features" className="landing-vision-link">Explore what you can do today <ArrowRight size={16} /></a></div>
        </section>

        <section id="faq" className="landing-faq landing-section">
          <div className="landing-faq-heading"><span className="landing-eyebrow">GOOD TO KNOW</span><h2>Questions, <em>answered.</em></h2><p>Want to know how OjaFlow works before you get started?</p><span className="landing-faq-icon"><CircleHelp size={25} /></span></div>
          <div className="landing-faq-list">{faqs.map(({ question, answer }) => <details key={question}><summary>{question}<span className="landing-faq-plus" aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="landing-final-cta"><div><span className="landing-eyebrow">A BETTER HOME FOR YOUR BUSINESS RECORDS</span><h2>Give your business records<br /><em>a better home.</em></h2><p>Keep useful business information together and make it easier to come back to what you have recorded.</p><div className="landing-hero-actions"><a className="landing-button landing-button-light" href="#/register">Create account <ArrowRight size={18} /></a><a className="landing-cta-signin" href="#/login">Already have an account? Sign in</a></div></div><div className="landing-cta-graphic" aria-hidden="true"><div className="landing-cta-ring ring-one" /><div className="landing-cta-ring ring-two" /><span><ReceiptText size={33} /></span></div></section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-main">
          <div className="landing-footer-brand"><a className="landing-brand-link" href="/" aria-label="OjaFlow home"><BrandLogo /></a><p>Business records for Nigerian traders and small businesses.</p></div>
          <div className="landing-footer-col"><strong>Explore</strong>{sectionLink('features', 'Features')}{sectionLink('how-it-works', 'How it works')}{sectionLink('faq', 'FAQs')}</div>
          <div className="landing-footer-col"><strong>Your account</strong><a href="#/register">Create account</a><a href="#/login">Sign in</a><a href="#product-preview">Product preview</a></div>
          <div className="landing-footer-col"><strong>Information</strong><button type="button" onClick={() => onOpenLegal('privacy')}>Privacy policy</button><button type="button" onClick={() => onOpenLegal('terms')}>Terms and conditions</button></div>
        </div>
        <div className="landing-footer-bottom"><span>© {new Date().getFullYear()} OjaFlow. All rights reserved.</span><span>Made for the work you do every day.</span></div>
      </footer>
    </div>
  );
}
