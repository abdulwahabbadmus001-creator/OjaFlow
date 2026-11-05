import {
  ArrowRight,
  BellRing,
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
import { t } from '../lib/language';
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
  const snap = businessSnapshot(data);

  const recent = [...data.sales]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const lowStockProducts = data.products.filter(
    product => product.stock > 0 && product.stock <= product.reorderLevel
  );

  const outOfStockProducts = data.products.filter(
    product => product.stock <= 0
  );

  const stockAlerts = [...outOfStockProducts, ...lowStockProducts];
  const totalUnitsInStock = data.products.reduce(
    (sum, product) => sum + Math.max(0, Number(product.stock) || 0),
    0
  );

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? t(profile.preferredLanguage, 'greeting.morning')
      : hour < 17
        ? t(profile.preferredLanguage, 'greeting.afternoon')
        : t(profile.preferredLanguage, 'greeting.evening');

  const salesChange =
    snap.yesterdayRevenue === 0
      ? null
      : ((snap.revenue - snap.yesterdayRevenue) /
          snap.yesterdayRevenue) *
        100;

  return (
    <>
      {stockAlerts.length > 0 && (
        <section
          className="low-stock-alarm-banner"
          role="alert"
          aria-live="assertive"
        >
          <div className="low-stock-alarm-top">
            <div className="low-stock-alarm-icon-wrap">
              <span className="low-stock-alarm-beacon" />
              <BellRing size={22} className="low-stock-alarm-bell" />
            </div>

            <div className="low-stock-alarm-copy">
              <div className="low-stock-alarm-headline">
                <span className="low-stock-alarm-tag">
                  URGENT LOW-STOCK ALARM
                </span>
                <span className="low-stock-alarm-total">
                  Total shop stock: <strong>{totalUnitsInStock} units</strong> across{' '}
                  {data.products.length} item{data.products.length === 1 ? '' : 's'}
                </span>
              </div>

              <h2>
                {outOfStockProducts.length > 0 && lowStockProducts.length > 0
                  ? `${outOfStockProducts.length} item${
                      outOfStockProducts.length === 1 ? '' : 's'
                    } out of stock & ${lowStockProducts.length} running low!`
                  : outOfStockProducts.length > 0
                    ? `${outOfStockProducts.length} product${
                        outOfStockProducts.length === 1 ? '' : 's'
                      } completely out of stock (0 left)!`
                    : `${lowStockProducts.length} product${
                        lowStockProducts.length === 1 ? '' : 's'
                      } running dangerously low on stock!`}
              </h2>
            </div>

            <button
              type="button"
              className="low-stock-alarm-cta"
              onClick={onOpenInventory}
            >
              Restock Now <ArrowRight size={16} />
            </button>
          </div>

          <div className="low-stock-alarm-items">
            {stockAlerts.map(product => {
              const isOut = product.stock <= 0;
              return (
                <button
                  type="button"
                  key={product.id}
                  className={`low-stock-alarm-chip ${isOut ? 'out' : 'low'}`}
                  onClick={onOpenInventory}
                >
                  <span className="chip-dot" />
                  <strong>{product.name}</strong>
                  <span className="chip-count">
                    {isOut
                      ? '0 left • OUT OF STOCK'
                      : `${product.stock} left (min ${product.reorderLevel})`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <header className="page-head dashboard-head">
        <div>
          <span className="eyebrow">
            {t(profile.preferredLanguage, 'dashboard.eyebrow')}
          </span>

          <h1>
            {greeting}, {profile.firstName}.
          </h1>

          <p>
            {t(profile.preferredLanguage, 'dashboard.subtitle')}{' '}
            <strong>{business.businessName}</strong>.
          </p>
        </div>

        <div className="date-chip">
          {new Intl.DateTimeFormat('en-NG', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          }).format(new Date())}
        </div>
      </header>

      {stockAlerts.length > 0 && (
        <section className="panel attention-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">INVENTORY ALERT</span>

              <h2>
                {outOfStockProducts.length > 0
                  ? `${outOfStockProducts.length} product${
                      outOfStockProducts.length === 1 ? '' : 's'
                    } out of stock`
                  : `${lowStockProducts.length} product${
                      lowStockProducts.length === 1 ? '' : 's'
                    } running low`}
              </h2>

              <p>
                {outOfStockProducts.length > 0
                  ? 'Some products can no longer be sold until you restock them.'
                  : 'Some products have reached their reorder level and may need restocking soon.'}
              </p>
            </div>

            <CircleAlert size={24} />
          </div>

          <div className="list">
            {stockAlerts.slice(0, 5).map(product => {
              const isOut = product.stock <= 0;

              return (
                <div className="list-row" key={product.id}>
                  <div className="list-icon warning">
                    <CircleAlert size={18} />
                  </div>

                  <div className="grow">
                    <strong>{product.name}</strong>

                    <span>
                      {isOut
                        ? 'This product is out of stock'
                        : `Reorder level: ${product.reorderLevel}`}
                    </span>
                  </div>

                  <span className="status-badge amber">
                    {isOut ? 'Out of stock' : `${product.stock} left`}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="primary-btn"
            onClick={onOpenInventory}
          >
            Open inventory <ArrowRight size={17} />
          </button>
        </section>
      )}

      <section className="dashboard-hero">
        <div className="hero-main">
          <span className="hero-label">TODAY&apos;S CASH MOVEMENT</span>

          <strong>{money(snap.cashMovement)}</strong>

          <p>
            Recorded sales minus today&apos;s recorded expenses.
          </p>

          <div className="hero-inline-stats">
            <span>
              <small>
                {t(profile.preferredLanguage, 'dashboard.sales')}
              </small>
              <b>{money(snap.revenue)}</b>
            </span>

            <span>
              <small>
                {t(profile.preferredLanguage, 'dashboard.expenses')}
              </small>
              <b>{money(snap.expenses)}</b>
            </span>

            <span>
              <small>Gross profit estimate</small>
              <b>{money(snap.estimatedGrossProfit)}</b>
            </span>
          </div>
        </div>

        <div className="hero-side">
          <span className="hero-side-label">Sales vs yesterday</span>

          {salesChange === null ? (
            <strong className="neutral-change">
              No prior-day baseline
            </strong>
          ) : (
            <strong
              className={
                salesChange >= 0
                  ? 'positive-change'
                  : 'negative-change'
              }
            >
              {salesChange >= 0 ? (
                <TrendingUp size={20} />
              ) : (
                <TrendingDown size={20} />
              )}

              {Math.abs(salesChange).toFixed(1)}%
            </strong>
          )}

          <small>
            Yesterday: {money(snap.yesterdayRevenue)}
          </small>
        </div>
      </section>

      <BusinessTrendChart
        data={data}
        language={profile.preferredLanguage}
      />

      <section className="metric-grid refined">
        <Metric
          title="Outstanding customer debt"
          value={money(snap.outstandingCustomerDebt)}
          icon={<HandCoins />}
          note={`${
            data.debts.filter(
              debt =>
                debt.type === 'customer' &&
                debt.amount > debt.paid
            ).length
          } open records`}
          action="Review debts"
          onClick={onOpenDebts}
        />

        <Metric
          title="Inventory retail value"
          value={money(snap.inventoryRetailValue)}
          icon={<Package />}
          note={`${data.products.length} products tracked`}
          action="Open inventory"
          onClick={onOpenInventory}
        />

        <Metric
          title="Customers"
          value={String(data.customers.length)}
          icon={<ReceiptText />}
          note={`${data.invoices.length} invoice${
            data.invoices.length === 1 ? '' : 's'
          } created`}
          action="Open CRM"
          onClick={onOpenSales}
        />

        <Metric
          title="Low-stock items"
          value={String(stockAlerts.length)}
          icon={<CircleAlert />}
          note={
            stockAlerts.length
              ? 'Needs your attention'
              : 'Stock levels look healthy'
          }
          action="Check stock"
          onClick={onOpenInventory}
          warning={stockAlerts.length > 0}
        />
      </section>

      <section className="dashboard-grid polished">
        <article className="panel activity-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">RECENT ACTIVITY</span>
              <h2>Latest sales</h2>
            </div>

            <button
              className="panel-link"
              onClick={onOpenSales}
            >
              View all <ArrowRight size={16} />
            </button>
          </div>

          {recent.length ? (
            <div className="list">
              {recent.map(sale => (
                <div className="list-row" key={sale.id}>
                  <div className="list-icon">
                    <ReceiptText size={18} />
                  </div>

                  <div className="grow">
                    <strong>{sale.itemName}</strong>

                    <span>
                      {sale.quantity} item
                      {sale.quantity === 1 ? '' : 's'} •{' '}
                      {sale.paymentMethod}
                    </span>
                  </div>

                  <strong>{money(sale.total)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Your first recorded sale will appear here." />
          )}
        </article>

        <article className="panel attention-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ATTENTION</span>
              <h2>Stock watch</h2>
            </div>

            <button
              className="panel-link"
              onClick={onOpenInventory}
            >
              Inventory <ArrowRight size={16} />
            </button>
          </div>

          {stockAlerts.length ? (
            <div className="list">
              {stockAlerts.slice(0, 4).map(product => (
                <div className="list-row" key={product.id}>
                  <div className="list-icon warning">
                    <CircleAlert size={18} />
                  </div>

                  <div className="grow">
                    <strong>{product.name}</strong>

                    <span>
                      Reorder at {product.reorderLevel}
                    </span>
                  </div>

                  <span className="status-badge amber">
                    {product.stock <= 0
                      ? 'Out of stock'
                      : `${product.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No product is currently at its reorder level." />
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
    <article
      className={`metric-card refined-card ${
        warning ? 'warning-card' : ''
      }`}
    >
      <div className="metric-top">
        <span>{title}</span>
        <div className="metric-icon">{icon}</div>
      </div>

      <strong className="metric-value">{value}</strong>

      <small>{note}</small>

      <button
        className="metric-action"
        onClick={onClick}
        disabled={!onClick}
      >
        {action} <ArrowRight size={14} />
      </button>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}