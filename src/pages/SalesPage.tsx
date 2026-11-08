import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  MessageCircle,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Share2,
  Users,
  WalletCards
} from 'lucide-react';
import type {
  BusinessProfile,
  Customer,
  Expense,
  Invoice,
  LanguagePreference,
  Sale,
  StoreData
} from '../types';
import { money, todayISO, uid } from '../lib/format';
import Modal from '../components/Modal';
import RouteFallback from '../components/RouteFallback';
import { useI18n } from '../lib/i18n';

const LazyExpensesView = lazy(() => import('./ExpensesPage'));
const LazyCustomersView = lazy(() => import('./CustomersPage'));
const LazyCustomerForm = lazy(() =>
  import('./CustomersPage').then(mod => ({ default: mod.CustomerForm }))
);
const LazyInvoicesView = lazy(() => import('./InvoicesPage'));
const LazyInvoiceForm = lazy(() =>
  import('./InvoicesPage').then(mod => ({ default: mod.InvoiceForm }))
);

export type SalesSubTab = 'sales' | 'expenses' | 'customers' | 'invoices';

export default function SalesPage({
  data,
  business,
  preferredLanguage,
  addSale,
  addExpense,
  addCustomer,
  updateCustomer,
  addInvoice,
  updateInvoice,
  initialTab
}: {
  data: StoreData;
  business: BusinessProfile;
  preferredLanguage: LanguagePreference;
  addSale: (item: Sale) => void;
  addExpense: (item: Expense) => void;
  addCustomer: (item: Customer) => void;
  updateCustomer: (item: Customer) => void;
  addInvoice: (item: Invoice) => void;
  updateInvoice: (item: Invoice) => void;
  initialTab?: SalesSubTab;
}) {
  const { tr, locale } = useI18n();
  const [tab, setTab] = useState<SalesSubTab>(() => {
    if (initialTab) return initialTab;
    const requested = sessionStorage.getItem('ojaflow:sales-tab');
    if (requested) {
      sessionStorage.removeItem('ojaflow:sales-tab');
      if (
        requested === 'sales' ||
        requested === 'expenses' ||
        requested === 'customers' ||
        requested === 'invoices'
      ) {
        return requested;
      }
    }
    return 'sales';
  });

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const [modal, setModal] = useState<
    null | 'sale' | 'expense' | 'customer' | 'invoice'
  >(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [query, setQuery] = useState('');
  const lower = query.toLowerCase();

  const customerById = useMemo(
    () => new Map(data.customers.map(customer => [customer.id, customer])),
    [data.customers]
  );

  function receiptCustomer(sale: Sale) {
    if (sale.customerId) return customerById.get(sale.customerId);
    return data.customers.find(
      customer =>
        customer.name.toLowerCase() === (sale.customer || '').toLowerCase()
    );
  }

  async function openReceiptWhatsApp(sale: Sale) {
    const customer = receiptCustomer(sale);
    const { saleWhatsAppUrl } = await import('../lib/documents');
    const url = saleWhatsAppUrl(
      business,
      sale,
      customer?.phone,
      preferredLanguage
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{tr('CUSTOMERS & MONEY FLOW')}</span>
          <h1>{tr('Sales, CRM & invoices')}</h1>
          <p>
            {tr(
              'Record transactions, understand customers and create professional documents.'
            )}
          </p>
        </div>
        <button
          className="primary-btn"
          onClick={() =>
            setModal(
              tab === 'sales'
                ? 'sale'
                : tab === 'expenses'
                  ? 'expense'
                  : tab === 'customers'
                    ? 'customer'
                    : 'invoice'
            )
          }
        >
          <Plus size={18} />
          {tab === 'sales'
            ? tr('Record sale')
            : tab === 'expenses'
              ? tr('Add expense')
              : tab === 'customers'
                ? tr('Add customer')
                : tr('invoice.create')}
        </button>
      </header>

      <div className="segmented sales-segmented">
        <button
          className={tab === 'sales' ? 'active' : ''}
          onClick={() => setTab('sales')}
        >
          <ReceiptText size={17} /> {tr('Sales')}
        </button>
        <button
          className={tab === 'expenses' ? 'active' : ''}
          onClick={() => setTab('expenses')}
        >
          <WalletCards size={17} /> {tr('Expenses')}
        </button>
        <button
          className={tab === 'customers' ? 'active' : ''}
          onClick={() => setTab('customers')}
        >
          <Users size={17} /> {tr('crm.title')}
        </button>
        <button
          className={tab === 'invoices' ? 'active' : ''}
          onClick={() => setTab('invoices')}
        >
          <FileText size={17} /> {tr('invoice.title')}
        </button>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <div className="search">
            <Search size={18} />
            <input
              placeholder={tr('Search records')}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
        </div>

        {tab === 'sales' && (
          <div className="data-table receipt-table">
            <div className="table-head five">
              <span>{tr('Item')}</span>
              <span>{tr('Customer')}</span>
              <span>{tr('Payment')}</span>
              <span className="right">{tr('Amount')}</span>
              <span className="right">{tr('Document')}</span>
            </div>
            {data.sales
              .filter(item =>
                `${item.itemName} ${item.customer || ''}`
                  .toLowerCase()
                  .includes(lower)
              )
              .map(sale => (
                <div className="table-row five" key={sale.id}>
                  <span>
                    <strong>{sale.itemName}</strong>
                    <small>
                      {sale.quantity} × {money(sale.unitPrice)} •{' '}
                      {new Date(sale.createdAt).toLocaleDateString(locale)}
                    </small>
                  </span>
                  <span>{sale.customer || tr('Walk-in')}</span>
                  <span>{tr(sale.paymentMethod)}</span>
                  <strong className="right">{money(sale.total)}</strong>
                  <span className="row-actions right">
                    <button
                      type="button"
                      className="secondary-btn compact whatsapp-btn"
                      title={tr('Share via WhatsApp')}
                      onClick={() => void openReceiptWhatsApp(sale)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.78rem'
                      }}
                    >
                      <MessageCircle size={15} />
                      <span>{tr('Share via WhatsApp')}</span>
                    </button>
                    <button
                      className="icon-action"
                      title={tr('Share or download PNG image receipt')}
                      onClick={() => {
                        void import('../lib/receiptImage').then(
                          ({ shareOrDownloadSaleReceiptImage }) =>
                            shareOrDownloadSaleReceiptImage(business, sale)
                        );
                      }}
                    >
                      <Share2 size={16} />
                    </button>
                    <button
                      className="icon-action"
                      title={tr('Open receipt')}
                      onClick={() => {
                        void import('../lib/documents').then(
                          ({ printReceipt }) => {
                            printReceipt(business, sale, preferredLanguage);
                          }
                        );
                      }}
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      className="icon-action"
                      title={tr('Download receipt')}
                      onClick={() => {
                        void import('../lib/documents').then(
                          ({ downloadReceipt }) => {
                            downloadReceipt(business, sale, preferredLanguage);
                          }
                        );
                      }}
                    >
                      <Download size={16} />
                    </button>
                  </span>
                </div>
              ))}
            {!data.sales.length && (
              <div className="empty-state">
                {tr(
                  'Record a sale to generate your first professional receipt.'
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'expenses' && (
          <Suspense fallback={<RouteFallback label={tr('Loading expenses…')} />}>
            <LazyExpensesView
              data={data}
              addExpense={addExpense}
              embedded
              query={lower}
            />
          </Suspense>
        )}

        {tab === 'customers' && (
          <Suspense fallback={<RouteFallback label={tr('Loading customers…')} />}>
            <LazyCustomersView
              data={data}
              business={business}
              language={preferredLanguage}
              query={lower}
              embedded
              onEdit={setEditingCustomer}
              onInvoice={customer => {
                setEditingCustomer(null);
                setModal('invoice');
                sessionStorage.setItem('ojaflow:invoice-customer', customer.id);
              }}
            />
          </Suspense>
        )}

        {tab === 'invoices' && (
          <Suspense fallback={<RouteFallback label={tr('Loading invoices…')} />}>
            <LazyInvoicesView
              invoices={data.invoices.filter(invoice =>
                `${invoice.invoiceNumber} ${invoice.customerName}`
                  .toLowerCase()
                  .includes(lower)
              )}
              business={business}
              language={preferredLanguage}
              onUpdate={updateInvoice}
            />
          </Suspense>
        )}
      </div>

      {modal === 'sale' && (
        <Modal title={tr('Record sale')} onClose={() => setModal(null)}>
          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const quantity = Number(form.get('quantity'));
              const unitPrice = Number(form.get('unitPrice'));
              const customerId = String(form.get('customerId') || '');
              const customer = data.customers.find(
                item => item.id === customerId
              );
              addSale({
                id: uid(),
                itemName: String(form.get('itemName')),
                quantity,
                unitPrice,
                total: quantity * unitPrice,
                paymentMethod: String(
                  form.get('paymentMethod')
                ) as Sale['paymentMethod'],
                customer: customer?.name || '',
                customerId: customer?.id,
                createdAt: todayISO()
              });
              setModal(null);
            }}
          >
            <label>
              {tr('Item')}
              <input name="itemName" list="product-options" required />
            </label>
            <datalist id="product-options">
              {data.products.map(product => (
                <option key={product.id} value={product.name} />
              ))}
            </datalist>
            <div className="two-col">
              <label>
                {tr('Quantity')}
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                />
              </label>
              <label>
                {tr('Unit price')}
                <input name="unitPrice" type="number" min="0" required />
              </label>
            </div>
            <label>
              {tr('Payment method')}
              <select name="paymentMethod">
                <option value="Cash">{tr('Cash')}</option>
                <option value="Transfer">{tr('Transfer')}</option>
                <option value="POS">POS</option>
                <option value="Credit">{tr('Credit')}</option>
              </select>
            </label>
            <label>
              {tr('Customer')} <span className="optional">{tr('Optional')}</span>
              <select name="customerId" defaultValue="">
                <option value="">{tr('Walk-in customer')}</option>
                {data.customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-btn full">
              {tr('Save sale & enable receipt')}
            </button>
          </form>
        </Modal>
      )}

      {modal === 'expense' && (
        <Modal title={tr('Record an expense')} onClose={() => setModal(null)}>
          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              addExpense({
                id: uid(),
                category: String(form.get('category')),
                description: String(form.get('description')),
                amount: Number(form.get('amount')),
                createdAt: todayISO()
              });
              setModal(null);
            }}
          >
            <label>
              {tr('Description')}
              <input name="description" required />
            </label>
            <label>
              {tr('Category')}
              <select name="category">
                <option value="Transport">{tr('Transport')}</option>
                <option value="Supplies">{tr('Supplies')}</option>
                <option value="Rent">{tr('Rent')}</option>
                <option value="Utilities">{tr('Utilities')}</option>
                <option value="Salary">{tr('Salary')}</option>
                <option value="Other">{tr('Other')}</option>
              </select>
            </label>
            <label>
              {tr('Amount')}
              <input name="amount" type="number" min="0" required />
            </label>
            <button className="primary-btn full">{tr('Save expense')}</button>
          </form>
        </Modal>
      )}

      {modal === 'customer' && (
        <Modal title={tr('Add customer')} onClose={() => setModal(null)}>
          <Suspense fallback={<RouteFallback />}>
            <LazyCustomerForm
              onSave={customer => {
                addCustomer(customer);
                setModal(null);
              }}
            />
          </Suspense>
        </Modal>
      )}

      {editingCustomer && (
        <Modal
          title={`${tr('Customer CRM')} — ${editingCustomer.name}`}
          onClose={() => setEditingCustomer(null)}
        >
          <Suspense fallback={<RouteFallback />}>
            <LazyCustomerForm
              customer={editingCustomer}
              onSave={customer => {
                updateCustomer(customer);
                setEditingCustomer(null);
              }}
            />
          </Suspense>
        </Modal>
      )}

      {modal === 'invoice' && (
        <Modal
          title={tr('Create professional invoice')}
          onClose={() => {
            setModal(null);
            sessionStorage.removeItem('ojaflow:invoice-customer');
          }}
        >
          <Suspense fallback={<RouteFallback />}>
            <LazyInvoiceForm
              customers={data.customers}
              initialCustomerId={
                sessionStorage.getItem('ojaflow:invoice-customer') || ''
              }
              onCreate={invoice => {
                addInvoice(invoice);
                setModal(null);
                sessionStorage.removeItem('ojaflow:invoice-customer');
                void import('../lib/documents').then(({ printInvoice }) => {
                  printInvoice(business, invoice, preferredLanguage);
                });
              }}
            />
          </Suspense>
        </Modal>
      )}
    </>
  );
}
