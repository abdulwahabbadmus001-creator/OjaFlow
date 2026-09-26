import {
  ArrowRight,
  CircleAlert,
  HandCoins,
  Package,
  ReceiptText,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import type { BusinessProfile, StoreData, UserProfile } from '../types';
import { money } from '../lib/format';
import { businessSnapshot } from '../lib/localChat';
import { useI18n } from '../lib/i18n';
import BusinessTrendChart from '../components/BusinessTrendChart';

export default function Dashboard({
  profile,
  business,
  data,
  onOpenSales,
  onOpenInventory,
  onOpenDebts
}: {
  profile: UserProfile;
  business: BusinessProfile;
  data: StoreData;
  onOpenSales?: () => void;
  onOpenInventory?: () => void;
  onOpenDebts?: () => void;
}) {
  const { tr, locale } = useI18n();
  const snap = businessSnapshot(data);
  const recent = [...data.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const low = data.products.filter(product => product.stock <= product.reorderLevel).slice(0, 4);
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? tr('greeting.morning')
    : hour < 17
      ? tr('greeting.afternoon')
      : tr('greeting.evening');
  const salesChange = snap.yesterdayRevenue === 0
    ? null
    : ((snap.revenue - snap.yesterdayRevenue) / snap.yesterdayRevenue) * 100;

  return (
    <>
      <header className="page-head dashboard-head">
        <div>
          <span className="eyebrow">{tr('dashboard.eyebrow')}</span>
          <h1>{greeting}, {profile.firstName}.</h1>
          <p>{tr('dashboard.subtitle')} <strong>{business.businessName}</strong>.</p>
        </div>
        <div className="date-chip">
          {new Intl.DateTimeFormat(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          }).format(new Date())}
        </div>
      </header>

      <section className="dashboard-hero">
        <div className="hero-main">
          <span className="hero-label">{tr("TODAY\'S CASH MOVEMENT")}</span>
          <strong>{money(snap.cashMovement)}</strong>
          <p>{tr("Recorded sales minus today's recorded expenses.")}</p>
          <div className="hero-inline-stats">
            <span>
              <small>{tr('dashboard.sales')}</small>
              <b>{money(snap.revenue)}</b>
            </span>
            <span>
              <small>{tr('dashboard.expenses')}</small>
              <b>{money(snap.expenses)}</b>
            </span>
            <span>
              <small>{tr('Gross profit estimate')}</small>
              <b>{money(snap.estimatedGrossProfit)}</b>
            </span>
          </div>
        </div>
        <div className="hero-side">
          <span className="hero-side-label">{tr('Sales vs yesterday')}</span>
          {salesChange === null ? (
            <strong className="neutral-change">{tr('No prior-day baseline')}</strong>
          ) : (
            <strong className={salesChange >= 0 ? 'positive-change' : 'negative-change'}>
              {salesChange >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              {Math.abs(salesChange).toFixed(1)}%
            </strong>
          )}
          <small>{tr('Yesterday')}: {money(snap.yesterdayRevenue)}</small>
        </div>
      </section>

      <BusinessTrendChart data={data} language={profile.preferredLanguage} />

      <section className="metric-grid refined">
        <Metric
          title={tr('Outstanding customer debt')}
          value={money(snap.outstandingCustomerDebt)}
          icon={<HandCoins />}
          note={tr('{count} open records', { count: data.debts.filter(debt => debt.type === 'customer' && debt.amount > debt.paid).length })}
          action={tr('Review debts')}
          onClick={onOpenDebts}
        />
        <Metric
          title={tr('Inventory retail value')}
          value={money(snap.inventoryRetailValue)}
          icon={<Package />}
          note={tr('{count} products tracked', { count: data.products.length })}
          action={tr('Open inventory')}
          onClick={onOpenInventory}
        />
        <Metric
          title={tr('Customers')}
          value={String(data.customers.length)}
          icon={<ReceiptText />}
          note={tr('{count} invoices created', { count: data.invoices.length })}
          action={tr('Open CRM')}
          onClick={onOpenSales}
        />
        <Metric
          title={tr('Low-stock items')}
          value={String(snap.lowStock.length)}
          icon={<CircleAlert />}
          note={snap.lowStock.length ? tr('Needs your attention') : tr('Stock levels look healthy')}
          action={tr('Check stock')}
          onClick={onOpenInventory}
          warning={snap.lowStock.length > 0}
        />
      </section>

      <section className="dashboard-grid polished">
        <article className="panel activity-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">{tr('RECENT ACTIVITY')}</span>
              <h2>{tr('Latest sales')}</h2>
            </div>
            <button className="panel-link" onClick={onOpenSales}>{tr('View all')} <ArrowRight size={16} /></button>
          </div>
          {recent.length ? (
            <div className="list">
              {recent.map(sale => (
                <div className="list-row" key={sale.id}>
                  <div className="list-icon"><ReceiptText size={18} /></div>
                  <div className="grow">
                    <strong>{sale.itemName}</strong>
                    <span>{tr('{count} items', { count: sale.quantity })} • {sale.paymentMethod}</span>
                  </div>
                  <strong>{money(sale.total)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty text={tr('Your first recorded sale will appear here.')} />
          )}
        </article>

        <article className="panel attention-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">{tr('ATTENTION')}</span>
              <h2>{tr('Stock watch')}</h2>
            </div>
            <button className="panel-link" onClick={onOpenInventory}>{tr('Inventory')} <ArrowRight size={16} /></button>
          </div>
          {low.length ? (
            <div className="list">
              {low.map(product => (
                <div className="list-row" key={product.id}>
                  <div className="list-icon warning"><CircleAlert size={18} /></div>
                  <div className="grow">
                    <strong>{product.name}</strong>
                    <span>{tr('Reorder at {level}', { level: product.reorderLevel })}</span>
                  </div>
                  <span className="status-badge amber">{tr('{count} left', { count: product.stock })}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty text={tr('No product is currently at its reorder level.')} />
          )}
        </article>
      </section>
    </>
  );
}

function Metric({
  title,
  value,
  note,
  icon,
  action,
  onClick,
  warning
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  action: string;
  onClick?: () => void;
  warning?: boolean;
}) {
  return (
    <article className={`metric-card refined-card ${warning ? 'warning-card' : ''}`}>
      <div className="metric-top">
        <span>{title}</span>
        <div className="metric-icon">{icon}</div>
      </div>
      <strong className="metric-value">{value}</strong>
      <small>{note}</small>
      <button className="metric-action" onClick={onClick} disabled={!onClick}>
        {action} <ArrowRight size={14} />
      </button>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}