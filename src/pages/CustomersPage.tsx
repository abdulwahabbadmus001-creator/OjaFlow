import { useState } from 'react';
import { FileText, MessageCircle, Pencil, Phone, Plus, Search } from 'lucide-react';
import type {
  BusinessProfile,
  Customer,
  LanguagePreference,
  StoreData
} from '../types';
import { money, todayISO, uid } from '../lib/format';
import Modal from '../components/Modal';
import {
  customerFollowUpMessage,
  customerMetrics,
  openWhatsApp
} from '../lib/customerCrm';
import { useI18n } from '../lib/i18n';

export function CustomerForm({
  customer,
  onSave
}: {
  customer?: Customer;
  onSave: (customer: Customer) => void;
}) {
  const { tr } = useI18n();
  return (
    <form
      className="form-stack"
      onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          id: customer?.id || uid(),
          name: String(form.get('name') || '').trim(),
          phone: String(form.get('phone') || '').trim(),
          address: String(form.get('address') || '').trim(),
          notes: String(form.get('notes') || '').trim(),
          tags: String(form.get('tags') || '')
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean),
          whatsappOptIn: form.get('whatsappOptIn') === 'on',
          createdAt: customer?.createdAt || todayISO()
        });
      }}
    >
      <label>
        {tr('Customer name')}
        <input name="name" defaultValue={customer?.name || ''} required />
      </label>
      <label>
        {tr('Phone number')}
        <input name="phone" defaultValue={customer?.phone || ''} required />
      </label>
      <label>
        {tr('Address')} <span className="optional">{tr('Optional')}</span>
        <input name="address" defaultValue={customer?.address || ''} />
      </label>
      <label>
        {tr('CRM tags')} <span className="optional">{tr('Comma separated')}</span>
        <input
          name="tags"
          defaultValue={(customer?.tags || []).join(', ')}
          placeholder={tr('VIP, wholesale, regular')}
        />
      </label>
      <label>
        {tr('Customer notes')} <span className="optional">{tr('Optional')}</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={customer?.notes || ''}
          placeholder={tr('Preferences, follow-up notes, useful context')}
        />
      </label>
      <label className="check-row">
        <input
          name="whatsappOptIn"
          type="checkbox"
          defaultChecked={customer?.whatsappOptIn || false}
        />{' '}
        {tr('Customer has agreed to receive business updates on WhatsApp')}
      </label>
      <button className="primary-btn full">
        {customer ? tr('Save CRM changes') : tr('Add customer')}
      </button>
    </form>
  );
}

export function CustomerCrmGrid({
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
  const lower = query.toLowerCase();
  const customers = data.customers.filter(customer =>
    `${customer.name} ${customer.phone} ${(customer.tags || []).join(' ')}`
      .toLowerCase()
      .includes(lower)
  );
  if (!customers.length) {
    return (
      <div className="empty-state">
        {tr('Add customers to start building your customer relationship history.')}
      </div>
    );
  }

  return (
    <div className="crm-grid">
      {customers.map(customer => {
        const metrics = customerMetrics(customer, data);
        return (
          <article className="crm-card" key={customer.id}>
            <div className="crm-card-head">
              <div className="customer-avatar">
                {customer.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="grow">
                <strong>{customer.name}</strong>
                <span>{customer.phone}</span>
              </div>
              <button
                className="icon-action"
                onClick={() => onEdit(customer)}
                title={tr('Edit customer CRM')}
              >
                <Pencil size={16} />
              </button>
            </div>
            <div className="crm-metrics">
              <div>
                <span>{tr('Total spent')}</span>
                <strong>{money(metrics.totalSpent)}</strong>
              </div>
              <div>
                <span>{tr('Purchases')}</span>
                <strong>{metrics.salesCount}</strong>
              </div>
              <div>
                <span>{tr('Outstanding')}</span>
                <strong>{money(metrics.outstandingDebt)}</strong>
              </div>
              <div>
                <span>{tr('Last purchase')}</span>
                <strong>
                  {metrics.lastPurchase
                    ? new Date(metrics.lastPurchase).toLocaleDateString(locale)
                    : '—'}
                </strong>
              </div>
            </div>
            {!!customer.tags?.length && (
              <div className="tag-row">
                {customer.tags.map(tag => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
            {customer.notes && <p className="crm-note">{customer.notes}</p>}
            <div className="crm-actions">
              <a className="secondary-btn compact" href={`tel:${customer.phone}`}>
                <Phone size={16} /> {tr('Call')}
              </a>
              <button
                className="secondary-btn compact whatsapp-btn"
                onClick={() =>
                  openWhatsApp(
                    customer.phone,
                    customerFollowUpMessage(
                      customer,
                      business.businessName,
                      language
                    )
                  )
                }
              >
                <MessageCircle size={16} /> WhatsApp
              </button>
              <button
                className="primary-btn compact"
                onClick={() => onInvoice(customer)}
              >
                <FileText size={16} /> {tr('Invoice')}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function CustomersPage({
  data,
  business,
  language,
  query = '',
  embedded = false,
  onEdit,
  onInvoice,
  addCustomer,
  updateCustomer
}: {
  data: StoreData;
  business: BusinessProfile;
  language: LanguagePreference;
  query?: string;
  embedded?: boolean;
  onEdit?: (customer: Customer) => void;
  onInvoice?: (customer: Customer) => void;
  addCustomer?: (customer: Customer) => void;
  updateCustomer?: (customer: Customer) => void;
}) {
  const { tr } = useI18n();
  const [internalQuery, setInternalQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  if (embedded) {
    return (
      <CustomerCrmGrid
        data={data}
        business={business}
        language={language}
        query={query}
        onEdit={onEdit || (c => setEditing(c))}
        onInvoice={onInvoice || (() => undefined)}
      />
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{tr('CUSTOMER RELATIONSHIPS')}</span>
          <h1>{tr('crm.title')}</h1>
          <p>{tr('crm.subtitle')}</p>
        </div>
        {addCustomer && (
          <button className="primary-btn" onClick={() => setAdding(true)}>
            <Plus size={18} />
            {tr('Add customer')}
          </button>
        )}
      </header>

      <div className="panel">
        <div className="table-toolbar">
          <div className="search">
            <Search size={18} />
            <input
              placeholder={tr('Search records')}
              value={internalQuery}
              onChange={event => setInternalQuery(event.target.value)}
            />
          </div>
        </div>
        <CustomerCrmGrid
          data={data}
          business={business}
          language={language}
          query={internalQuery}
          onEdit={onEdit || (c => setEditing(c))}
          onInvoice={onInvoice || (() => undefined)}
        />
      </div>

      {adding && addCustomer && (
        <Modal title={tr('Add customer')} onClose={() => setAdding(false)}>
          <CustomerForm
            onSave={customer => {
              addCustomer(customer);
              setAdding(false);
            }}
          />
        </Modal>
      )}

      {editing && updateCustomer && (
        <Modal
          title={`${tr('Customer CRM')} — ${editing.name}`}
          onClose={() => setEditing(null)}
        >
          <CustomerForm
            customer={editing}
            onSave={customer => {
              updateCustomer(customer);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
