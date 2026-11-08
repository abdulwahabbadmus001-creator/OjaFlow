import { useState } from 'react';
import { CheckCircle2, Download, Plus, Printer, Send } from 'lucide-react';
import type {
  BusinessProfile,
  Customer,
  Invoice,
  InvoiceLine,
  LanguagePreference
} from '../types';
import { money, todayISO, uid } from '../lib/format';
import { useI18n } from '../lib/i18n';

export function InvoiceForm({
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
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: uid(), description: '', quantity: 1, unitPrice: 0 }
  ]);
  const customer = customers.find(item => item.id === customerId);
  const total = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );

  function changeLine(id: string, patch: Partial<InvoiceLine>) {
    setLines(current =>
      current.map(line => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  return (
    <form
      className="form-stack"
      onSubmit={event => {
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
      }}
    >
      <label>
        {tr('Customer')}
        <select
          value={customerId}
          onChange={event => setCustomerId(event.target.value)}
          required
        >
          <option value="">{tr('Select customer')}</option>
          {customers.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="invoice-lines">
        {lines.map((line, index) => (
          <div className="invoice-line" key={line.id}>
            <label className="invoice-description">
              {tr('Item / service')}
              <input
                value={line.description}
                onChange={event =>
                  changeLine(line.id, { description: event.target.value })
                }
                required
              />
            </label>
            <label>
              {tr('Qty')}
              <input
                type="number"
                min="1"
                value={line.quantity}
                onChange={event =>
                  changeLine(line.id, { quantity: Number(event.target.value) })
                }
                required
              />
            </label>
            <label>
              {tr('Unit price')}
              <input
                type="number"
                min="0"
                value={line.unitPrice}
                onChange={event =>
                  changeLine(line.id, { unitPrice: Number(event.target.value) })
                }
                required
              />
            </label>
            {index > 0 && (
              <button
                type="button"
                className="text-btn danger-text"
                onClick={() =>
                  setLines(current =>
                    current.filter(item => item.id !== line.id)
                  )
                }
              >
                {tr('Remove')}
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="secondary-btn"
        onClick={() =>
          setLines(current => [
            ...current,
            { id: uid(), description: '', quantity: 1, unitPrice: 0 }
          ])
        }
      >
        <Plus size={16} /> {tr('Add line')}
      </button>
      <div className="two-col">
        <label>
          {tr('Due date')} <span className="optional">{tr('Optional')}</span>
          <input name="dueDate" type="date" />
        </label>
        <label>
          {tr('Invoice total')}
          <input value={money(total)} disabled />
        </label>
      </div>
      <label>
        {tr('Note')} <span className="optional">{tr('Optional')}</span>
        <textarea
          name="note"
          rows={3}
          placeholder={tr('Payment instructions or customer note')}
        />
      </label>
      <button
        className="primary-btn full"
        disabled={
          !customer || !lines.length || lines.some(line => !line.description.trim())
        }
      >
        {tr('Create & open invoice')}
      </button>
    </form>
  );
}

export default function InvoicesPage({
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
  if (!invoices.length) {
    return (
      <div className="empty-state">
        {tr('Create an invoice for a customer and it will appear here.')}
      </div>
    );
  }

  return (
    <div className="invoice-list">
      {invoices.map(invoice => (
        <article className="invoice-card" key={invoice.id}>
          <div className="invoice-card-top">
            <div>
              <span className="eyebrow">{invoice.invoiceNumber}</span>
              <h3>{invoice.customerName}</h3>
              <small>
                {new Date(invoice.createdAt).toLocaleDateString(locale)}
              </small>
            </div>
            <span className={`invoice-status ${invoice.status}`}>
              {tr(invoice.status)}
            </span>
          </div>
          <strong className="invoice-total">{money(invoice.total)}</strong>
          <div className="invoice-actions">
            <button
              className="secondary-btn compact whatsapp-btn"
              onClick={() => {
                void import('../lib/documents').then(({ invoiceWhatsAppUrl }) => {
                  window.open(
                    invoiceWhatsAppUrl(invoice, business, language),
                    '_blank',
                    'noopener,noreferrer'
                  );
                });
              }}
            >
              <Send size={16} /> {tr('Share via WhatsApp')}
            </button>
            <button
              className="secondary-btn compact"
              onClick={() => {
                void import('../lib/documents').then(({ printInvoice }) => {
                  printInvoice(business, invoice, language);
                });
              }}
            >
              <Printer size={16} /> {tr('Print / PDF')}
            </button>
            <button
              className="secondary-btn compact"
              onClick={() => {
                void import('../lib/documents').then(({ downloadInvoice }) => {
                  downloadInvoice(business, invoice, language);
                });
              }}
            >
              <Download size={16} /> {tr('Download')}
            </button>
            {invoice.status !== 'paid' && (
              <button
                className="primary-btn compact"
                onClick={() => onUpdate({ ...invoice, status: 'paid' })}
              >
                <CheckCircle2 size={16} /> {tr('Mark paid')}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
