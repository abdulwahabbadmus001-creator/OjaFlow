import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Send,
  Users,
  WalletCards
} from 'lucide-react';
import type {
  BusinessProfile,
  Customer,
  Expense,
  Invoice,
  InvoiceLine,
  LanguagePreference,
  Sale,
  StoreData
} from '../types';
import { money, todayISO, uid } from '../lib/format';
import Modal from '../components/Modal';
import { customerFollowUpMessage, customerMetrics, openWhatsApp } from '../lib/customerCrm';
import {
  downloadInvoice,
  downloadReceipt,
  invoiceWhatsAppUrl,
  printInvoice,
  printReceipt
} from '../lib/documents';
import { useI18n } from '../lib/i18n';

export default function SalesPage({
  data,
  business,
  preferredLanguage,
  addSale,
  addExpense,
  addCustomer,
  updateCustomer,
  addInvoice,
  updateInvoice
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
}) {
  const { tr, locale } = useI18n();
  const [tab, setTab] = useState<'sales' | 'expenses' | 'customers' | 'invoices'>('sales');
  const [modal, setModal] = useState<null | 'sale' | 'expense' | 'customer' | 'invoice'>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [query, setQuery] = useState('');
  const lower = query.toLowerCase();

  const customerById = useMemo(() => new Map(data.customers.map(customer => [customer.id, customer])), [data.customers]);

  function receiptCustomer(sale: Sale) {
    if (sale.customerId) return customerById.get(sale.customerId);
    return data.customers.find(customer => customer.name.toLowerCase() === (sale.customer || '').toLowerCase());
  }

  function openReceiptWhatsApp(sale: Sale) {
    const customer = receiptCustomer(sale);
    if (!customer?.phone) return;
    openWhatsApp(
      customer.phone,
      tr(
        'Hello {customer}, thank you for your purchase from {business}. Your receipt total is {amount}. Receipt reference: {reference}.',
        {
          customer: customer.name,
          business: business.businessName,
          amount: money(sale.total),
          reference: `RCPT-${sale.id.slice(0, 8).toUpperCase()}`
        }
      )
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{tr('CUSTOMERS & MONEY FLOW')}</span>
          <h1>{tr('Sales, CRM & invoices')}</h1>
          <p>{tr('Record transactions, understand customers and create professional documents.')}</p>
        </div>
        <button
          className="primary-btn"
          onClick={() => setModal(tab === 'sales' ? 'sale' : tab === 'expenses' ? 'expense' : tab === 'customers' ? 'customer' : 'invoice')}
        >
          <Plus size={18} />
          {tab === 'sales' ? tr('Record sale') : tab === 'expenses' ? tr('Add expense') : tab === 'customers' ? tr('Add customer') : tr('invoice.create')}
        </button>
      </header>

      <div className="segmented sales-segmented">
        <button className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}><ReceiptText size={17} /> {tr('Sales')}</button>
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}><WalletCards size={17} /> {tr('Expenses')}</button>
        <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}><Users size={17} /> {tr('crm.title')}</button>
        <button className={tab === 'invoices' ? 'active' : ''} onClick={() => setTab('invoices')}><FileText size={17} /> {tr('invoice.title')}</button>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <div className="search"><Search size={18} /><input placeholder={tr('Search records')} value={query} onChange={event => setQuery(event.target.value)} /></div>
        </div>

        {tab === 'sales' && (
          <div className="data-table receipt-table">
            <div className="table-head five"><span>{tr('Item')}</span><span>{tr('Customer')}</span><span>{tr('Payment')}</span><span className="right">{tr('Amount')}</span><span className="right">{tr('Document')}</span></div>
            {data.sales.filter(item => `${item.itemName} ${item.customer || ''}`.toLowerCase().includes(lower)).map(sale => {
              const customer = receiptCustomer(sale);
              return (
                <div className="table-row five" key={sale.id}>
                  <span><strong>{sale.itemName}</strong><small>{sale.quantity} × {money(sale.unitPrice)} • {new Date(sale.createdAt).toLocaleDateString(locale)}</small></span>
                  <span>{sale.customer || tr('Walk-in')}</span>
                  <span>{tr(sale.paymentMethod)}</span>
                  <strong className="right">{money(sale.total)}</strong>
                  <span className="row-actions right">
                    <button className="icon-action" title={tr('Open receipt')} onClick={() => printReceipt(business, sale, preferredLanguage)}><Printer size={16} /></button>
                    <button className="icon-action" title={tr('Download receipt')} onClick={() => downloadReceipt(business, sale, preferredLanguage)}><Download size={16} /></button>
                    {customer?.phone && <button className="icon-action whatsapp" title={tr('Send receipt summary on WhatsApp')} onClick={() => openReceiptWhatsApp(sale)}><MessageCircle size={16} /></button>}
                  </span>
                </div>
              );
            })}
            {!data.sales.length && <div className="empty-state">{tr('Record a sale to generate your first professional receipt.')}</div>}
          </div>
        )}

        {tab === 'expenses' && (
          <div className="data-table">
            <div className="table-head"><span>{tr('Description')}</span><span>{tr('Category')}</span><span>{tr('Date')}</span><span className="right">{tr('Amount')}</span></div>
            {data.expenses.filter(item => `${item.description}${item.category}`.toLowerCase().includes(lower)).map(expense => (
              <div className="table-row" key={expense.id}>
                <span><strong>{expense.description}</strong></span>
                <span>{tr(expense.category)}</span>
                <span>{new Date(expense.createdAt).toLocaleDateString(locale)}</span>
                <strong className="right negative">−{money(expense.amount)}</strong>
              </div>
            ))}
          </div>
        )}

        {tab === 'customers' && (
          <CustomerCrm
            data={data}
            business={business}
            language={preferredLanguage}
            query={lower}
            onEdit={setEditingCustomer}
            onInvoice={customer => {
              setEditingCustomer(null);
              setModal('invoice');
              sessionStorage.setItem('ojaflow:invoice-customer', customer.id);
            }}
          />
        )}

        {tab === 'invoices' && (
          <InvoiceList
            invoices={data.invoices.filter(invoice => `${invoice.invoiceNumber} ${invoice.customerName}`.toLowerCase().includes(lower))}
            business={business}
            language={preferredLanguage}
            onUpdate={updateInvoice}
          />
        )}
      </div>

      {modal === 'sale' && (
        <Modal title={tr('Record sale')} onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const quantity = Number(form.get('quantity'));
            const unitPrice = Number(form.get('unitPrice'));
            const customerId = String(form.get('customerId') || '');
            const customer = data.customers.find(item => item.id === customerId);
            addSale({
              id: uid(),
              itemName: String(form.get('itemName')),
              quantity,
              unitPrice,
              total: quantity * unitPrice,
              paymentMethod: String(form.get('paymentMethod')) as Sale['paymentMethod'],
              customer: customer?.name || '',
              customerId: customer?.id,
              createdAt: todayISO()
            });
            setModal(null);
          }}>
            <label>{tr('Item')}<input name="itemName" list="product-options" required /></label>
            <datalist id="product-options">{data.products.map(product => <option key={product.id} value={product.name} />)}</datalist>
            <div className="two-col">
              <label>{tr('Quantity')}<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
              <label>{tr('Unit price')}<input name="unitPrice" type="number" min="0" required /></label>
            </div>
            <label>{tr('Payment method')}<select name="paymentMethod"><option value="Cash">{tr('Cash')}</option><option value="Transfer">{tr('Transfer')}</option><option value="POS">POS</option><option value="Credit">{tr('Credit')}</option></select></label>
            <label>{tr('Customer')} <span className="optional">{tr('Optional')}</span>
              <select name="customerId" defaultValue=""><option value="">{tr('Walk-in customer')}</option>{data.customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
            </label>
            <button className="primary-btn full">{tr('Save sale & enable receipt')}</button>
          </form>
        </Modal>
      )}

      {modal === 'expense' && (
        <Modal title={tr('Record an expense')} onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            addExpense({ id: uid(), category: String(form.get('category')), description: String(form.get('description')), amount: Number(form.get('amount')), createdAt: todayISO() });
            setModal(null);
          }}>
            <label>{tr('Description')}<input name="description" required /></label>
            <label>{tr('Category')}<select name="category"><option value="Transport">{tr('Transport')}</option><option value="Supplies">{tr('Supplies')}</option><option value="Rent">{tr('Rent')}</option><option value="Utilities">{tr('Utilities')}</option><option value="Salary">{tr('Salary')}</option><option value="Other">{tr('Other')}</option></select></label>
            <label>{tr('Amount')}<input name="amount" type="number" min="0" required /></label>
            <button className="primary-btn full">{tr('Save expense')}</button>
          </form>
        </Modal>
      )}

      {modal === 'customer' && (
        <Modal title={tr('Add customer')} onClose={() => setModal(null)}>
          <CustomerForm onSave={customer => { addCustomer(customer); setModal(null); }} />
        </Modal>
      )}

      {editingCustomer && (
        <Modal title={`${tr('Customer CRM')} — ${editingCustomer.name}`} onClose={() => setEditingCustomer(null)}>
          <CustomerForm customer={editingCustomer} onSave={customer => { updateCustomer(customer); setEditingCustomer(null); }} />
        </Modal>
      )}

      {modal === 'invoice' && (
        <Modal title={tr('Create professional invoice')} onClose={() => { setModal(null); sessionStorage.removeItem('ojaflow:invoice-customer'); }}>
          <InvoiceForm
            customers={data.customers}
            initialCustomerId={sessionStorage.getItem('ojaflow:invoice-customer') || ''}
            onCreate={invoice => {
              addInvoice(invoice);
              setModal(null);
              sessionStorage.removeItem('ojaflow:invoice-customer');
              printInvoice(business, invoice, preferredLanguage);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function CustomerCrm({
  data,
  business,
  language,
  query,
  onEdit,
  onInvoice
}: {
  data: StoreData;
  business: BusinessProfile;
  language: LanguagePreference;
  query: string;
  onEdit: (customer: Customer) => void;
  onInvoice: (customer: Customer) => void;
}) {
  const { tr, locale } = useI18n();
  const customers = data.customers.filter(customer => `${customer.name} ${customer.phone} ${(customer.tags || []).join(' ')}`.toLowerCase().includes(query));
  if (!customers.length) return <div className="empty-state">{tr('Add customers to start building your customer relationship history.')}</div>;

  return (
    <div className="crm-grid">
      {customers.map(customer => {
        const metrics = customerMetrics(customer, data);
        return (
          <article className="crm-card" key={customer.id}>
            <div className="crm-card-head">
              <div className="customer-avatar">{customer.name.slice(0, 1).toUpperCase()}</div>
              <div className="grow"><strong>{customer.name}</strong><span>{customer.phone}</span></div>
              <button className="icon-action" onClick={() => onEdit(customer)} title={tr('Edit customer CRM')}><Pencil size={16} /></button>
            </div>
            <div className="crm-metrics">
              <div><span>{tr('Total spent')}</span><strong>{money(metrics.totalSpent)}</strong></div>
              <div><span>{tr('Purchases')}</span><strong>{metrics.salesCount}</strong></div>
              <div><span>{tr('Outstanding')}</span><strong>{money(metrics.outstandingDebt)}</strong></div>
              <div><span>{tr('Last purchase')}</span><strong>{metrics.lastPurchase ? new Date(metrics.lastPurchase).toLocaleDateString(locale) : '—'}</strong></div>
            </div>
            {!!customer.tags?.length && <div className="tag-row">{customer.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
            {customer.notes && <p className="crm-note">{customer.notes}</p>}
            <div className="crm-actions">
              <a className="secondary-btn compact" href={`tel:${customer.phone}`}><Phone size={16} /> {tr('Call')}</a>
              <button className="secondary-btn compact whatsapp-btn" onClick={() => openWhatsApp(customer.phone, customerFollowUpMessage(customer, business.businessName, language))}><MessageCircle size={16} /> WhatsApp</button>
              <button className="primary-btn compact" onClick={() => onInvoice(customer)}><FileText size={16} /> {tr('Invoice')}</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CustomerForm({ customer, onSave }: { customer?: Customer; onSave: (customer: Customer) => void }) {
  const { tr } = useI18n();
  return (
    <form className="form-stack" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      onSave({
        id: customer?.id || uid(),
        name: String(form.get('name') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        address: String(form.get('address') || '').trim(),
        notes: String(form.get('notes') || '').trim(),
        tags: String(form.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean),
        whatsappOptIn: form.get('whatsappOptIn') === 'on',
        createdAt: customer?.createdAt || todayISO()
      });
    }}>
      <label>{tr('Customer name')}<input name="name" defaultValue={customer?.name || ''} required /></label>
      <label>{tr('Phone number')}<input name="phone" defaultValue={customer?.phone || ''} required /></label>
      <label>{tr('Address')} <span className="optional">{tr('Optional')}</span><input name="address" defaultValue={customer?.address || ''} /></label>
      <label>{tr('CRM tags')} <span className="optional">{tr('Comma separated')}</span><input name="tags" defaultValue={(customer?.tags || []).join(', ')} placeholder={tr('VIP, wholesale, regular')} /></label>
      <label>{tr('Customer notes')} <span className="optional">{tr('Optional')}</span><textarea name="notes" rows={3} defaultValue={customer?.notes || ''} placeholder={tr('Preferences, follow-up notes, useful context')} /></label>
      <label className="check-row"><input name="whatsappOptIn" type="checkbox" defaultChecked={customer?.whatsappOptIn || false} /> {tr('Customer has agreed to receive business updates on WhatsApp')}</label>
      <button className="primary-btn full">{customer ? tr('Save CRM changes') : tr('Add customer')}</button>
    </form>
  );
}

function InvoiceForm({
  customers,
  initialCustomerId,
  onCreate
}: {
  customers: Customer[];
  initialCustomerId: string;
  onCreate: (invoice: Invoice) => void;
}) {
  const { tr } = useI18n();
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [lines, setLines] = useState<InvoiceLine[]>([{ id: uid(), description: '', quantity: 1, unitPrice: 0 }]);
  const customer = customers.find(item => item.id === customerId);
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  function changeLine(id: string, patch: Partial<InvoiceLine>) {
    setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line));
  }

  return (
    <form className="form-stack" onSubmit={event => {
      event.preventDefault();
      if (!customer) return;
      const form = new FormData(event.currentTarget);
      const invoice: Invoice = {
        id: uid(),
        invoiceNumber: `INV-${Date.now().toString().slice(-8)}`,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        items: lines,
        subtotal: total,
        total,
        status: 'draft',
        dueDate: String(form.get('dueDate') || '') || undefined,
        note: String(form.get('note') || '').trim() || undefined,
        createdAt: todayISO()
      };
      onCreate(invoice);
    }}>
      <label>{tr('Customer')}<select value={customerId} onChange={event => setCustomerId(event.target.value)} required><option value="">{tr('Select customer')}</option>{customers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="invoice-lines">
        {lines.map((line, index) => (
          <div className="invoice-line" key={line.id}>
            <label className="invoice-description">{tr('Item / service')}<input value={line.description} onChange={event => changeLine(line.id, { description: event.target.value })} required /></label>
            <label>{tr('Qty')}<input type="number" min="1" value={line.quantity} onChange={event => changeLine(line.id, { quantity: Number(event.target.value) })} required /></label>
            <label>{tr('Unit price')}<input type="number" min="0" value={line.unitPrice} onChange={event => changeLine(line.id, { unitPrice: Number(event.target.value) })} required /></label>
            {index > 0 && <button type="button" className="text-btn danger-text" onClick={() => setLines(current => current.filter(item => item.id !== line.id))}>{tr('Remove')}</button>}
          </div>
        ))}
      </div>
      <button type="button" className="secondary-btn" onClick={() => setLines(current => [...current, { id: uid(), description: '', quantity: 1, unitPrice: 0 }])}><Plus size={16} /> {tr('Add line')}</button>
      <div className="two-col">
        <label>{tr('Due date')} <span className="optional">{tr('Optional')}</span><input name="dueDate" type="date" /></label>
        <label>{tr('Invoice total')}<input value={money(total)} disabled /></label>
      </div>
      <label>{tr('Note')} <span className="optional">{tr('Optional')}</span><textarea name="note" rows={3} placeholder={tr('Payment instructions or customer note')} /></label>
      <button className="primary-btn full" disabled={!customer || !lines.length || lines.some(line => !line.description.trim())}>{tr('Create & open invoice')}</button>
    </form>
  );
}

function InvoiceList({
  invoices,
  business,
  language,
  onUpdate
}: {
  invoices: Invoice[];
  business: BusinessProfile;
  language: LanguagePreference;
  onUpdate: (invoice: Invoice) => void;
}) {
  const { tr, locale } = useI18n();
  if (!invoices.length) return <div className="empty-state">{tr('Create an invoice for a customer and it will appear here.')}</div>;
  return (
    <div className="invoice-list">
      {invoices.map(invoice => (
        <article className="invoice-card" key={invoice.id}>
          <div className="invoice-card-top">
            <div><span className="eyebrow">{invoice.invoiceNumber}</span><h3>{invoice.customerName}</h3><small>{new Date(invoice.createdAt).toLocaleDateString(locale)}</small></div>
            <span className={`invoice-status ${invoice.status}`}>{tr(invoice.status)}</span>
          </div>
          <strong className="invoice-total">{money(invoice.total)}</strong>
          <div className="invoice-actions">
            <button className="secondary-btn compact" onClick={() => printInvoice(business, invoice, language)}><Printer size={16} /> {tr('Print / PDF')}</button>
            <button className="secondary-btn compact" onClick={() => downloadInvoice(business, invoice, language)}><Download size={16} /> {tr('Download')}</button>
            {invoice.customerPhone && <button className="secondary-btn compact whatsapp-btn" onClick={() => window.open(invoiceWhatsAppUrl(invoice, business, language), '_blank', 'noopener,noreferrer')}><Send size={16} /> WhatsApp</button>}
            {invoice.status !== 'paid' && <button className="primary-btn compact" onClick={() => onUpdate({ ...invoice, status: 'paid' })}><CheckCircle2 size={16} /> {tr('Mark paid')}</button>}
          </div>
        </article>
      ))}
    </div>
  );
}